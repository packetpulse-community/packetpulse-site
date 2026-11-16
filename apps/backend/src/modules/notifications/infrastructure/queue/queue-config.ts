import { createHash } from "node:crypto";
import type { JobsOptions, WorkerOptions } from "bullmq";

// Single place for every background-job setting (TASK-016). See docs/ops/background-jobs.md.

export const EMAIL_QUEUE = "email";
export const FANOUT_QUEUE = "fanout";

const HOUR_S = 60 * 60;
const DAY_S = 24 * HOUR_S;

// Retries: email gets 5 tries at 10s,20s,40s,80s apart (~2.5 min) — long enough to ride
// out a provider blip, short enough that a reset code is not useless on arrival.
// Fan-out is a local DB write, so 3 quick tries (2s, 4s) are enough.
// Completed jobs are kept for 24h (and at most 10k) — that retention is also the window
// in which a repeated idempotency key is ignored. Failed jobs are kept 7 days (max 5k)
// so an operator can inspect and retry them; nothing grows without bound.
const RETENTION: Pick<JobsOptions, "removeOnComplete" | "removeOnFail"> = {
  removeOnComplete: { age: DAY_S, count: 10_000 },
  removeOnFail: { age: 7 * DAY_S, count: 5_000 },
};

export const EMAIL_ATTEMPTS = 5;
export const FANOUT_ATTEMPTS = 3;

export function emailJobOptions(backoffMs = 10_000): JobsOptions {
  return { attempts: EMAIL_ATTEMPTS, backoff: { type: "exponential", delay: backoffMs }, ...RETENTION };
}

export function fanoutJobOptions(backoffMs = 2_000): JobsOptions {
  return { attempts: FANOUT_ATTEMPTS, backoff: { type: "exponential", delay: backoffMs }, ...RETENTION };
}

// A worker renews its job lock every lockDuration/2. If it dies or its event loop is
// blocked the lock lapses and the next stalled check (every stalledInterval) either
// re-queues the job (once) or fails it. maxStalledCount 1 = one automatic recovery.
export const STALL_SETTINGS: Pick<WorkerOptions, "lockDuration" | "stalledInterval" | "maxStalledCount"> = {
  lockDuration: 30_000,
  stalledInterval: 30_000,
  maxStalledCount: 1,
};

// Deterministic job id. BullMQ ignores an add() whose id already exists, so the same
// logical job enqueued twice runs once. Hashed so no token/OTP/address lands in Redis
// keys or logs (BullMQ ids may not contain ":" either).
export function idempotencyJobId(kind: string, ...parts: string[]): string {
  return `${kind}-${createHash("sha256").update(parts.join("\u0000")).digest("hex").slice(0, 32)}`;
}
