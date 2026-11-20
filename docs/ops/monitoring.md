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
2. **Uptime check and alert.** Built in the repo (`.github/workflows/uptime.yml`, see below) but **it only works once the owner sets two repository variables**; an independent external monitor is still recommended. Render's `healthCheckPath` only restarts the service, it tells no human.
3. **Alert routing to a named owner.** No alert goes anywhere because no owner is named (see open questions).
4. **Log retention and search.** Logs disappear quickly; needed for evidence in an incident.
5. **Audit trail for admin and permission actions** (TASK-015, separate work).
6. **Backup success monitoring**: the daily backup workflow goes red on failure; add a heartbeat URL so a *missing* run is noticed too ([backups.md](backups.md)).
7. **Dependency and secret alerts**: partly closed by the CI scans (see below) and GitHub Dependabot alerts (enable in repository settings).

## Uptime check on `/api/health`

`GET /api/health` is public and returns 200 with `{"status":"ok", ...}` when the database ping succeeds (5 s timeout), 503 otherwise. It is allowed during maintenance mode.

Things to know before alerting on it:

- **Render's free plan sleeps the service after about 15 minutes without traffic** and a cold start can take 30-60 seconds. A naive monitor will report false outages after quiet periods and its pings will also keep the service awake (which is a benefit for members and a cost question if the plan changes). Use a check timeout of at least 60 seconds and alert only after 2-3 consecutive failures.
- The check proves the backend and database respond. It does not prove login, email or the web app work. Add a second check on the web home page (`https://<web domain>/`) and, later, a synthetic login.
- Check every 5 minutes (the usual free interval).

### The built-in check: GitHub Actions uptime workflow (TASK-005)

`.github/workflows/uptime.yml` runs `scripts/ops/uptime-check.sh` every **10 minutes** against two URLs and fails the run (red X, GitHub notification email to repository watchers, optional webhook) when a probe returns anything but HTTP 200, the backend body lacks `"status":"ok"`, or the response takes longer than `UPTIME_SLOW_MS` (default 8000 ms). A failed first probe is retried once after 10 s, because a Render cold start takes 30-60 s; each probe waits up to 60 s.

| Setting | Where | Value |
|---|---|---|
| `UPTIME_BACKEND_URL` | repository **variable** | Full health URL, e.g. `https://<backend host>/api/health` |
| `UPTIME_WEB_URL` | repository **variable** | Web home page, e.g. `https://<web host>/` |
| `UPTIME_SLOW_MS` | repository variable, optional | Default `8000` |
| `ALERT_WEBHOOK_URL` | repository **secret**, optional | Slack, Discord or ntfy-style incoming webhook; gets a message with the run link on failure |

With no variables set the workflow succeeds and prints a notice ("Uptime checks not configured"), so nothing is red by accident.

**It doubles as the Render keep-warm ping.** The free plan sleeps after ~15 minutes idle; a request every 10 minutes keeps it awake (and also keeps the free Supabase project from pausing, because `/api/health` pings the database). Note this uses the free instance hours around the clock.

Honest limits of this tool:

- **5 minutes is the fastest GitHub allows**, and scheduled runs are best-effort: they can start minutes late or be skipped when GitHub is busy. 10 minutes was chosen to stay inside the keep-warm window with margin and to spend half the minutes.
- **Minutes:** every 10 minutes is ~4,300 runs a month. Public repositories are unlimited; a private repository on the free plan has 2,000 minutes, which this alone can exceed. If the repository is private, use `*/30` in the cron (the sleep window then needs a second keep-warm, so prefer an external monitor) or make the repository public.
- GitHub disables scheduled workflows after **60 days without repository activity**.
- It tells you a probe failed, not who answers at 3 a.m. Alerts go to whoever watches the repository, so fill in the owner table below and set the webhook.
- It cannot see the site from several regions, so treat it as a **backstop**. Keep an external monitor as the primary alert.

### External tools

| Tool | Free tier | Fit |
|---|---|---|
| UptimeRobot | 50 monitors, 5-minute interval, email alerts | Simplest; email alerts need no integration |
| Better Stack (Uptime) | Several monitors, 3-minute checks, email/phone push | Nicer status page and on-call |
| Grafana Cloud, Healthchecks.io | Free tiers | More setup; Healthchecks.io is the right tool for "did the nightly backup run" (`BACKUP_HEARTBEAT_URL`) |

Recommendation: the GitHub workflow now (zero cost, keep-warm), plus UptimeRobot or Better Stack for the primary alert, Sentry for errors, Resend's own alerts for email bounces. Configure each to alert the **incident lead** and the backup person named in the table below, by email first and a phone push app second.

## Owner table: who gets which alert (fill in)

One place for the owner to write down names. [incident-process.md](incident-process.md) uses the same people.

| Role | Name | Email | Phone / push | Backup person |
|---|---|---|---|---|
| Incident lead (receives all SEV1/SEV2 alerts) | `TO FILL` | `TO FILL` | `TO FILL` | `TO FILL` |
| Technical responder | `TO FILL` | `TO FILL` | `TO FILL` | `TO FILL` |
| Communications (member notices) | `TO FILL` | `TO FILL` | | |

| Alert route | Configured where | Sends to | Done? |
|---|---|---|---|
| Uptime workflow red | GitHub: watch the repository (Custom > Workflows) or `ALERT_WEBHOOK_URL` | Incident lead | `TO FILL` |
| Backup workflow red / heartbeat missed | GitHub notifications + Healthchecks.io | Incident lead, technical responder | `TO FILL` |
| External uptime monitor (UptimeRobot / Better Stack) | The tool's alert contacts | Incident lead, backup | `TO FILL` |
| Sentry issue alerts | Sentry project > Alerts | Technical responder | `TO FILL` |
| Resend bounce/complaint alerts | Resend dashboard | Communications | `TO FILL` |
| CI failure on `main` (secret scan, audit) | GitHub notifications | Technical responder | `TO FILL` |
| Render deploy/health failure | Render notification settings | Technical responder | `TO FILL` |

## Optional: error tracking with Sentry (not wired into the code yet)

Free "Developer" plan; one project for the backend, one for the web app. This is a note, not an implemented feature, because it needs a DSN and touches `apps/`.

1. Create a Sentry organisation and two projects (Node/NestJS, Next.js). Copy each DSN. A DSN is not a secret but keep it in environment settings, not in the repo.
2. Backend: `@sentry/nestjs` (initialise first in `main.ts`, before other imports; `SENTRY_DSN` and `SENTRY_ENVIRONMENT` in Render). Web: `@sentry/nextjs` wizard (`NEXT_PUBLIC_SENTRY_DSN` in Vercel).
3. Privacy: PacketPulse holds personal data. Set `sendDefaultPii: false`, do not attach request bodies, scrub `authorization`, `cookie`, and the same fields pino redacts, and set `tracesSampleRate: 0` (error tracking only). Mention Sentry as a processor in the privacy notice.
4. Web CSP: allow the Sentry ingest host in `connect-src` (coordinate with the CSP work in `docs/ops/web-security.md`); otherwise the browser reports are blocked.
5. Alerts: "new issue in production" and "issue frequency" to the technical responder (rows above).
6. Ties into the existing OpenTelemetry bootstrap: do not run both tracing exporters until one is chosen.

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

- Who are the incident lead and backup (the owner table above, same people as in incident-process.md)?
- Is the repository public or private (decides whether a 10-minute schedule fits the free Actions minutes)?
- Which uptime tool and which Sentry plan (free)?
- Should the free Render plan be kept (sleeps) or upgraded before launch?
- Which channel do members actually read (email, WhatsApp, Telegram) for notices?
