# Background jobs (BullMQ)

Slow or fallible work runs off the request thread on Redis-backed BullMQ queues, owned by
`apps/backend/src/modules/notifications`. Settings live in
`infrastructure/queue/queue-config.ts`.

## Queues and options

| Queue | Worker | Attempts | Backoff | Concurrency | Notes |
|---|---|---|---|---|---|
| `email` | `EmailProcessor` | 5 | exponential from 10s (10, 20, 40, 80s) | 1, limiter 2 jobs/s | Resend allows 2 req/s |
| `fanout` | `FanoutProcessor` | 3 | exponential from 2s | 5 | writes the `notifications` row, then pushes over the socket |

Retention: completed jobs 24h (max 10k); failed jobs 7 days (max 5k). Redis cannot grow
without limit, and failures stay visible for a week.
Stall settings: `lockDuration` 30s, `stalledInterval` 30s, `maxStalledCount` 1.
`QUEUE_BACKOFF_MS` (optional env) overrides the retry base delay; tests only.

## Idempotency keys

The job id is `<kind>-<sha256(key)[0..32]>`; enqueueing an existing id is ignored, so the
same logical job runs once. No token, code or address appears in the id.

| Job | Key |
|---|---|
| verification / approved-verify email | token |
| password reset OTP | address + code |
| welcome email | address |
| new-content email | content link + recipient |
| fan-out notification | user + type + optional `idempotencyKey` (4th arg to `notify`; callers that omit it get one notification per call) |

Role-change, approval, password-changed and security notices have no key (they can repeat
legitimately). The key is only remembered while the job is retained (24h completed, 7d failed).

## Permanent failures (no retry)

Invalid recipient address, template render error, Resend 4xx other than 408/429, SMTP 5xx,
and a fan-out whose user no longer exists. They throw `UnrecoverableError` and fail at once.

## Alerts

Every final failure, stall and worker error logs one JSON line at error level:

```
{"alert":true,"event":"job_failed","queue":"email","jobId":"password-reset-otp-3f...","attempts":5,"maxAttempts":5,"permanent":false,"reason":"provider down","template":"password-reset-otp","domain":"example.com"}
{"alert":true,"event":"job_stalled","queue":"email","jobId":"..."}
{"alert":true,"event":"worker_error","queue":"fanout","reason":"..."}
```

Alert on log lines containing `"alert":true`. Retries log `"alert":false,"event":"job_retry"` at
warn. Logs never contain message bodies, codes, links or full addresses (domain only).

## What to monitor

- Count of `"alert":true` lines per 15 min (any `job_failed` for `password-reset-otp` or
  `verification` is user-visible).
- `failed` count and `waiting` depth per queue (below), and a growing `waiting` with no
  `completed` = worker down or Redis unreachable.
- Redis memory (job payloads of reset/verification emails hold the code or link until removed).

## Inspect and retry

```bash
# counts for the email queue (prefix defaults to "bull")
redis-cli -u "$REDIS_URL" --scan --pattern 'bull:email:*' | head
redis-cli -u "$REDIS_URL" ZCARD bull:email:failed
redis-cli -u "$REDIS_URL" ZRANGE bull:email:failed 0 -1
redis-cli -u "$REDIS_URL" HGET bull:email:<jobId> failedReason
```

Retry a failed job from a Node shell in `apps/backend`:

```bash
node -e 'const {Queue}=require("bullmq");const q=new Queue("email",{connection:{url:process.env.REDIS_URL}});(async()=>{for(const j of await q.getFailed(0,50)){console.log(j.id,j.failedReason);await j.retry();}await q.close()})()'
```

Fix the cause first (provider key, bad address). Do not retry permanent failures.

## Known limits

- A stalled email re-queued after the first worker already handed it to the provider can
  send twice (at-least-once delivery); this is rare and bounded by `maxStalledCount` 1.
- Shutdown closes workers and queues via Nest (`app.close()`); SIGTERM handling needs
  `app.enableShutdownHooks()` in `main.ts`.
- Scheduled jobs (expiry checks, retention purges, invoices, parsing) are later tasks and will
  reuse these options.
