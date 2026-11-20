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

## Notifications (TASK-021, PRD-041)

One service decides, per notification and channel, whether to send now, defer or skip, and
writes a `notification_deliveries` row for every decision. Code:
`apps/backend/src/modules/notifications/application/services/notification-dispatcher.service.ts`.
The event catalogue and the policy defaults are in `packages/types/src/notifications.ts`.

| Channel | Rule |
|---|---|
| In-app | Always on, every event. Row `delivered`. |
| Email | Member preference, else the catalogue default. Critical events ignore the preference, quiet hours and the cap. |
| WhatsApp | Explicit opt-in AND a confirmed number, else `skipped:opt_out`. Then the member's choice, then `skipped:no_provider` (no provider is integrated, OPEN-18). |

Decisions on the delivery row (`status` / `reason_code`):
`delivered` (in-app), `queued` (email job exists), `queued:quiet_hours` (delayed job, `scheduled_for` =
when the window ends), `sent` / `failed` (set by the email worker; `attempts`, `error_summary` without
addresses or numbers), `skipped:preference_off | frequency_cap | no_provider | opt_out | no_address`.

**Quiet hours** (default 21:00 to 08:00 Asia/Kolkata, per member): a non-critical email becomes a BullMQ
job with `delay` = time until the window ends, on the same `email` queue, with job id
`notify-email-<sha256(delivery id)>` (so it is enqueued once). Nothing sleeps. Delayed jobs sit in Redis
until due; they are covered by the same retention, attempts, backoff and alert lines as every email.
**Daily cap** (default 3): non-critical email plus WhatsApp per member per local day, counted from queued,
sent and delivered rows under a per-member advisory lock. In-app is not counted.

**Which emails go through it.** Event emails from `notify()` (forum reply, blog comment, certificate) use
the generic `event-notice` template: fixed subject per event, body says that something happened, never what.
The approval, role-change and security-alert emails still come from the same `EmailQueueService` methods
(signatures unchanged) but resolve the member by address and go through the dispatcher; if the address is
not an account they are enqueued as before. **Verification, approved-verify, welcome, password-reset OTP and
password-changed emails never go through the dispatcher** (security-critical): same job ids, options, no
delay, no delivery row.

Policy configuration (all optional env, defaults from Document 1 section 10.3, owner approval pending):
`NOTIFY_DAILY_CAP`, `NOTIFY_QUIET_START`, `NOTIFY_QUIET_END`, `NOTIFY_TIMEZONE`.

Failure behaviour: a dispatch failure after the in-app row is saved is logged (`Dispatch failed`) and not
retried (a retry would insert a second in-app row). Updating the delivery row after a send never fails the
email job. `notify(..., { critical: true })` marks one message critical (interview within 24 h, offer expiring
within 48 h) for the later v2 senders.

Retention: purge `notification_deliveries` by `created_at` (indexed). No purge job exists yet.

Known gaps (follow-ups): digests are stored (`digest_frequency`) but not sent, so members who choose a digest
still get individual emails when they switch an event's email on; a deferred email is not re-checked against
preferences when it comes due; new-content announcements (`ContentAnnouncementService`) are unchanged and
ignore preferences, the cap and `marketing_opt_in`; the 24 h / 1 h interview reminders and badge-expiry
reminders need the scheduled-jobs work.
