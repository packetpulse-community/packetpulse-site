import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service";

@Injectable()
export class AdminSystemStatusService {
  constructor(private readonly prisma: PrismaService) {}

  // Real diagnostics only — no fabricated service list or random-number metrics
  // (the legacy app's SystemStatus page hardcoded a mock services array with fake
  // service names that don't exist in this stack). Everything here is measured.
  async status() {
    const dbStart = Date.now();
    let dbStatus: "operational" | "down" = "operational";
    let dbLatencyMs = 0;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbLatencyMs = Date.now() - dbStart;
    } catch {
      dbStatus = "down";
      dbLatencyMs = Date.now() - dbStart;
    }

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
      database: {
        status: dbStatus,
        latencyMs: dbLatencyMs,
      },
      timestamp: new Date().toISOString(),
    };
  }
}
