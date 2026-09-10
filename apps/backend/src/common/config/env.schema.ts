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
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  ADMIN_SECURE_CODE: z.string().min(16),
  CORS_ORIGINS: z.string().min(1), // comma-separated allowlist, never "*" (see plan §11)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  // Required only when PLATFORM_MODE=supabase (enforced below) — Auth, Realtime,
  // and Storage provider selection all key off these (see platform-mode plan §2-4).
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  SUPABASE_JWT_SECRET: z.string().min(1).optional(),
});

export const EnvSchema = BaseEnvSchema.superRefine((env, ctx) => {
  if (env.PLATFORM_MODE !== "supabase") return;
  const required = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_JWT_SECRET"] as const;
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
