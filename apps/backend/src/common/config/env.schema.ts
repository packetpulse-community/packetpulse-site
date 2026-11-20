import { z } from "zod";

// Validated once at boot — fails fast on a missing/invalid env var instead of
// surfacing as a runtime surprise later (see migration plan §3).
// PLATFORM_MODE selects which infrastructure providers get wired up at DI time
// (docker = local Postgres/Redis + custom JWT auth + Socket.IO realtime; supabase =
// Supabase-hosted Postgres/Auth/Realtime/Storage). Redis + BullMQ jobs are unaffected
// by this switch — Supabase has no queue equivalent, so jobs stay Redis-backed in
// both modes (see platform-mode plan §1).
const PlatformModeSchema = z.enum(["docker", "supabase"]).default("docker");

const BaseEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().default(4000),
  PLATFORM_MODE: PlatformModeSchema,
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  // Superseded by the SESSION_* limits below (kept so existing .env files still validate).
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  // Session limits (SEC-05), enforced when a refresh token is rotated. Members are signed out
  // after this many minutes without a refresh (sliding window; 43200 = 30 days).
  SESSION_MEMBER_IDLE_MINUTES: z.coerce.number().int().positive().default(43200),
  // Staff (see STAFF_ROLES): idle limit, and absolute limit from the first login of the session.
  SESSION_STAFF_IDLE_MINUTES: z.coerce.number().int().positive().default(30),
  SESSION_STAFF_ABSOLUTE_MINUTES: z.coerce.number().int().positive().default(480),
  // Per-account login lockout (TASK-013): failures allowed per email, and the window/lock length.
  LOGIN_MAX_FAILURES: z.coerce.number().int().positive().default(5),
  LOGIN_LOCK_MINUTES: z.coerce.number().int().positive().default(15),
  // Bot protection (TASK-013): Cloudflare Turnstile secret key. Unset = captcha disabled;
  // set = register/login/forgot-password/verify-otp require a valid token.
  TURNSTILE_SECRET_KEY: z.string().optional(),
  // Which proxies to trust for the client IP (finding S-11): true | false | hop count |
  // comma-separated IPs/CIDRs. Unset = true (today's behaviour). See docs/ops/bot-protection.md.
  TRUST_PROXY: z.string().optional(),
  ADMIN_SECURE_CODE: z.string().min(16),
  CORS_ORIGINS: z.string().min(1), // comma-separated allowlist, never "*" (see plan §11)
  // Base URL of the deployed frontend — used to build the clickable link sent in
  // the verification email (EmailQueueService), not just the raw token.
  // No localhost default — unset falls back to the first CORS origin
  // (common/config/frontend-url.ts) so production emails never link to localhost.
  FRONTEND_URL: z.string().url().optional(),
  // Preferred email transport (HTTPS, port 443). When set it is used instead of
  // SMTP — required on hosts that block outbound SMTP ports (e.g. Render free tier).
  RESEND_API_KEY: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  // Required only when PLATFORM_MODE=supabase (enforced below) — Auth, Realtime,
  // and Storage provider selection all key off these (see platform-mode plan §2-4).
  // SUPABASE_SECRET_KEY is Supabase's current "secret key" (sb_secret_...), the
  // replacement for the legacy JWT-format service_role key — same bypass-RLS
  // privileges, works as a drop-in value for supabase-js's server client.
  // No JWT-secret/JWKS var needed: our own JWT_ACCESS_SECRET still signs session
  // tokens in both modes — Supabase only stores/verifies credentials (plan §2).
  // Private bucket for resumes/certificates/evidence (TASK-014); never public. Must be created
  // as a private bucket in Supabase. Link lifetime is fixed at 60 s in code.
  STORAGE_PRIVATE_BUCKET: z.string().min(1).default("private-files"),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SECRET_KEY: z.string().min(1).optional(),
});

export const EnvSchema = BaseEnvSchema.superRefine((env, ctx) => {
  if (env.PLATFORM_MODE !== "supabase") return;
  const required = ["SUPABASE_URL", "SUPABASE_SECRET_KEY"] as const;
  for (const key of required) {
    if (!env[key]) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [key],
        message: `${key} is required when PLATFORM_MODE=supabase`,
      });
    }
  }
});

export type Env = z.infer<typeof BaseEnvSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = EnvSchema.safeParse(config);
  if (!parsed.success) {
    throw new Error(`Invalid environment configuration:\n${parsed.error.toString()}`);
  }
  return parsed.data;
}
