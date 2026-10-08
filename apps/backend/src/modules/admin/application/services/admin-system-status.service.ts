import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import { PrismaService } from "../../../../prisma/prisma.service";
import { REDIS_CLIENT } from "../../../../common/redis/redis.constants";
import { frontendUrl } from "../../../../common/config/frontend-url";

type ServiceState = "operational" | "degraded" | "down" | "not_configured";

export interface ServiceCheck {
  key: string;
  name: string;
  provider: string;
  status: ServiceState;
  latencyMs: number | null;
  detail?: string;
}

export interface EndpointCheck {
  method: "GET";
  path: string;
  auth: "public" | "member";
  status: "operational" | "degraded" | "down";
  httpStatus: number | null;
  latencyMs: number | null;
}

const CHECK_TIMEOUT_MS = 5_000;
// Anything slower than this still works but is flagged so slowness is visible.
const DEGRADED_AFTER_MS = 1_500;

// Representative reads across the main feature areas. "member" endpoints are
// called with the requesting admin's own cookie, so they exercise the real auth
// guard chain rather than a bypass.
const ENDPOINTS: { path: string; auth: "public" | "member" }[] = [
  { path: "/health", auth: "public" },
  { path: "/site-status", auth: "public" },
  { path: "/blogs?limit=1", auth: "public" },
  { path: "/categories", auth: "public" },
  { path: "/resources?limit=1", auth: "member" },
  { path: "/recordings?limit=1", auth: "member" },
  { path: "/forums/threads?limit=1", auth: "member" },
  { path: "/quizzes?limit=1", auth: "member" },
  { path: "/auth/me", auth: "member" },
];

function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out`)), CHECK_TIMEOUT_MS)),
  ]);
}

function stateFor(ok: boolean, latencyMs: number): ServiceState {
  if (!ok) return "down";
  return latencyMs > DEGRADED_AFTER_MS ? "degraded" : "operational";
}

@Injectable()
export class AdminSystemStatusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  // Real diagnostics only — no fabricated service list or random-number metrics
  // (the legacy app's SystemStatus page hardcoded a mock services array with fake
  // service names that don't exist in this stack). Everything here is measured,
  // all checks run concurrently, and each is capped at CHECK_TIMEOUT_MS.
  async status(cookieHeader?: string) {
    const [database, supabase, redis, frontend, backend, endpoints] = await Promise.all([
      this.checkDatabase(),
      this.checkSupabaseApi(),
      this.checkRedis(),
      this.checkFrontend(),
      this.checkBackendSelf(),
      Promise.all(ENDPOINTS.map((e) => this.checkEndpoint(e.path, e.auth, cookieHeader))),
    ]);

    const memory = process.memoryUsage();

    return {
      server: {
        status: "operational" as const,
        uptimeSeconds: Math.round(process.uptime()),
        nodeEnv: process.env.NODE_ENV ?? "development",
        nodeVersion: process.version,
      },
      memory: {
        rssMb: Math.round(memory.rss / 1024 / 1024),
        heapUsedMb: Math.round(memory.heapUsed / 1024 / 1024),
        heapTotalMb: Math.round(memory.heapTotal / 1024 / 1024),
      },
      // Kept for older clients; the same measurement also appears in `services`.
      database: { status: database.status === "down" ? ("down" as const) : ("operational" as const), latencyMs: database.latencyMs ?? 0 },
      services: [backend, frontend, database, supabase, redis],
      endpoints,
      timestamp: new Date().toISOString(),
    };
  }

  private async timed(fn: () => Promise<boolean>, label: string): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
    const start = Date.now();
    try {
      const ok = await withTimeout(fn(), label);
      return { ok, latencyMs: Date.now() - start };
    } catch (err) {
      return { ok: false, latencyMs: Date.now() - start, error: (err as Error).message };
    }
  }

  private async checkDatabase(): Promise<ServiceCheck> {
    const r = await this.timed(async () => {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    }, "Database query");
    return {
      key: "database",
      name: "Database (PostgreSQL)",
      provider: this.config.get<string>("PLATFORM_MODE") === "supabase" ? "Supabase" : "Postgres",
      status: stateFor(r.ok, r.latencyMs),
      latencyMs: r.latencyMs,
      detail: r.error,
    };
  }

  private async checkSupabaseApi(): Promise<ServiceCheck> {
    const url = this.config.get<string>("SUPABASE_URL");
    const key = this.config.get<string>("SUPABASE_SECRET_KEY");
    const base = { key: "supabase", name: "Supabase API (Auth/Storage/Realtime)", provider: "Supabase" };
    if (!url || !key) return { ...base, status: "not_configured", latencyMs: null };

    let httpStatus = 0;
    const r = await this.timed(async () => {
      const res = await fetch(`${url}/auth/v1/health`, { headers: { apikey: key } });
      httpStatus = res.status;
      return res.ok;
    }, "Supabase API");
    return { ...base, status: stateFor(r.ok, r.latencyMs), latencyMs: r.latencyMs, detail: r.error ?? (r.ok ? undefined : `HTTP ${httpStatus}`) };
  }

  private async checkRedis(): Promise<ServiceCheck> {
    const r = await this.timed(async () => (await this.redis.ping()) === "PONG", "Redis ping");
    return {
      key: "redis",
      name: "Redis (queues & presence)",
      provider: "Redis",
      status: stateFor(r.ok, r.latencyMs),
      latencyMs: r.latencyMs,
      detail: r.error,
    };
  }

  private async checkFrontend(): Promise<ServiceCheck> {
    const url = frontendUrl(this.config);
    const base = { key: "frontend", name: "Frontend (Next.js)", provider: "Vercel" };

    let httpStatus = 0;
    const r = await this.timed(async () => {
      // /login is a light page; HEAD avoids downloading the body.
      const res = await fetch(`${url}/login`, { method: "HEAD", redirect: "manual" });
      httpStatus = res.status;
      return res.status < 500;
    }, "Frontend");
    return { ...base, status: stateFor(r.ok, r.latencyMs), latencyMs: r.latencyMs, detail: r.error ?? (r.ok ? url : `HTTP ${httpStatus}`) };
  }

  // Loopback request to this process's own HTTP server — measures the full
  // Nest pipeline (guards, DB health query) without network distance. The
  // admin page adds the browser → backend round-trip on top of this.
  private async checkBackendSelf(): Promise<ServiceCheck> {
    const r = await this.timed(async () => (await fetch(`${this.loopbackBase()}/health`)).ok, "Backend health");
    return {
      key: "backend",
      name: "Backend API (NestJS)",
      provider: "Render",
      status: stateFor(r.ok, r.latencyMs),
      latencyMs: r.latencyMs,
      detail: r.error,
    };
  }

  private async checkEndpoint(path: string, auth: "public" | "member", cookieHeader?: string): Promise<EndpointCheck> {
    let httpStatus: number | null = null;
    const r = await this.timed(async () => {
      const res = await fetch(`${this.loopbackBase()}${path}`, {
        headers: auth === "member" && cookieHeader ? { Cookie: cookieHeader } : {},
      });
      httpStatus = res.status;
      return res.ok;
    }, path);
    return {
      method: "GET",
      path: `/api${path}`,
      auth,
      status: r.ok ? (r.latencyMs > DEGRADED_AFTER_MS ? "degraded" : "operational") : "down",
      httpStatus,
      latencyMs: r.latencyMs,
    };
  }

  private loopbackBase() {
    return `http://127.0.0.1:${this.config.get<number>("PORT") ?? 4000}/api`;
  }
}
