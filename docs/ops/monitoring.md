# Monitoring, logging and alerts

Document 4 TASK-005 (OPS-02). Describes what exists today, what is missing, and a free-tier plan to close the gap. Incident handling is in [incident-process.md](incident-process.md).

## What is logged today

| Source | Where | What | Notes |
|---|---|---|---|
| Backend request and application logs (pino via `nestjs-pino`) | stdout, collected by Render | One JSON line per request plus app logs; `LOG_LEVEL` sets the level (default `info`); pretty-printed outside production | `cookie`, `authorization`, `password`, `token` and `otp` are redacted (`observability/logging/logger.module.ts`). Render's free tier keeps logs only briefly and has no search or alerts. |
| `ClientLog` table | Database, written via the logs module | Errors and events sent from the browser (level, context, message, data, user id, IP, user agent) | Read by admins. Visitors can create entries, so treat content as untrusted and watch the volume. |
| Email send logging | Backend logs / queue | Outcome of verification and notification emails (BullMQ job results) | Resend's dashboard also shows delivery, bounces and complaints. |
| OpenTelemetry | `observability/tracing.ts` starts the Node SDK with auto-instrumentation | Traces are created but there is **no exporter configured**, so nothing leaves the process | Wasted overhead until an exporter is chosen. |
| Platform logs | Render, Vercel, Supabase dashboards | Deploy logs, function logs, database logs | Separate places, no single view. |

## What is missing

1. **Error tracking.** Unhandled exceptions are only in Render's short-lived logs. A hosted tracker (Sentry free plan) on the backend and the web app would group errors and notify someone.
2. **Uptime check and alert.** Nothing checks `/api/health` from outside. Render's `healthCheckPath` only restarts the service, it tells no human.
3. **Alert routing to a named owner.** No alert goes anywhere because no owner is named (see open questions).
4. **Log retention and search.** Logs disappear quickly; needed for evidence in an incident.
5. **Audit trail for admin and permission actions** (TASK-015, separate work).
6. **Backup success monitoring** (TASK-004, blocked on access).
7. **Dependency and secret alerts**: partly closed by the CI scans (see below) and GitHub Dependabot alerts (enable in repository settings).

## Uptime check on `/api/health`

`GET /api/health` is public and returns 200 with `{"status":"ok", ...}` when the database ping succeeds (5 s timeout), 503 otherwise. It is allowed during maintenance mode.

Things to know before alerting on it:

- **Render's free plan sleeps the service after about 15 minutes without traffic** and a cold start can take 30-60 seconds. A naive monitor will report false outages after quiet periods and its pings will also keep the service awake (which is a benefit for members and a cost question if the plan changes). Use a check timeout of at least 60 seconds and alert only after 2-3 consecutive failures.
- The check proves the backend and database respond. It does not prove login, email or the web app work. Add a second check on the web home page (`https://<web domain>/`) and, later, a synthetic login.
- Check every 5 minutes (the usual free interval).

### Free tools that could alert

| Tool | Free tier | Fit |
|---|---|---|
| UptimeRobot | 50 monitors, 5-minute interval, email alerts | Simplest; email alerts need no integration |
| Better Stack (Uptime) | Several monitors, 3-minute checks, email/phone push | Nicer status page and on-call |
| Grafana Cloud, Healthchecks.io | Free tiers | More setup; Healthchecks.io is useful for "did the nightly job run" (backups) |
| GitHub Actions scheduled workflow | Free minutes | Works but is not reliable enough for alerting; not recommended |

Recommendation: UptimeRobot or Better Stack for uptime, Sentry for errors, Resend's own alerts for email bounces. Configure each to alert the **incident lead** and a backup `[OWNER]`, by email first and a phone push app second.

## Alert rules (proposed)

| Signal | Condition | Severity | Goes to |
|---|---|---|---|
| `/api/health` down | 3 consecutive failures over 15 min | SEV2 (SEV1 if members also report data problems) | Incident lead, backup |
| Web home page down | 2 consecutive failures | SEV2 | Incident lead |
| New error type in Sentry | First occurrence in production | SEV3 | Technical responder |
| Error rate spike | More than 10x baseline for 10 min | SEV2 | Technical responder, incident lead |
| Email bounce/complaint spike | Resend dashboard alert | SEV3 | Communications |
| Secret scan or high-severity dependency finding | CI failure on `main` | SEV3 (SEV1 if a real secret leaked: rotate immediately) | Technical responder |

## Open questions for the owner

- Who are the incident lead and backup (`[OWNER]` in incident-process.md)?
- Which uptime tool and which Sentry plan (free)?
- Should the free Render plan be kept (sleeps) or upgraded before launch?
- Which channel do members actually read (email, WhatsApp, Telegram) for notices?
