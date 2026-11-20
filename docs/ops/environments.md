# Environments and secrets

Document 4 TASK-003. Status: written 2026-11; the staging row is a **plan**, not something that exists yet (see "Open questions").

## The four environments

| | Local | Preview | Staging | Production |
|---|---|---|---|---|
| Purpose | A developer's machine | One per pull request, to look at a UI change | Rehearsal of releases, migrations, restores | The real site and real members |
| Web | `next dev` on :3000 | Vercel preview deployment | Own Vercel project/domain (to be created) | Vercel production |
| Backend | `nest start` on :4000 | Normally none: previews call staging backend | Own Render service (to be created) | Render service `packetpulse-backend` (`render.yaml`) |
| Database | docker compose Postgres, `localhost:5433` | Staging database | **Own** Supabase project (to be created) | Production Supabase project |
| Redis | docker compose, `localhost:6380` | Staging Redis | Own Redis instance | Production Redis |
| `PLATFORM_MODE` | `docker` | `supabase` | `supabase` | `supabase` |
| Data | Seed/fake only | Fake only | Fake or anonymised only | Real member data |
| Email | Off (leave `RESEND_API_KEY`/`SMTP_*` empty) | Off or a test inbox | Resend with a restricted test sender, or off | Resend, real sender |

### Hard rules

1. **Staging and preview never read production data.** Separate database, Redis, Supabase project, JWT secrets and email keys. Never point a staging `DATABASE_URL` at the production project, never restore a raw production dump into staging. If staging needs realistic data, anonymise first (names, emails, phone numbers, free text) and record that in the restore drill (TASK-004).
2. **No secret in the repo.** Only `*.env.example` files with empty or obviously local values are tracked. Real values live in: Render environment (`sync: false` in `render.yaml`), Vercel project settings, and a developer's untracked `.env` / `.env.local`. CI scans for leaks (gitleaks, see `.github/workflows/ci.yml`). If a secret is ever committed, treat it as leaked: rotate it first, then clean history.
3. **Never run tests against a remote database.** The e2e suite creates and deletes users. `apps/backend/test/require-local-db.cjs` refuses to run unless `DATABASE_URL` is `localhost`, `127.0.0.1`, `::1` or the compose service `postgres`. Note that `apps/backend/.env` may point at a hosted database for running the app; tests must override it (see below).
4. **Every environment has its own secrets.** The JWT secrets, `ADMIN_SECURE_CODE` and API keys are generated per environment and never copied between them.
5. **Production changes go through CI.** Merge to `main` only with a green pipeline.

## Backend variables

Validated at boot by `apps/backend/src/common/config/env.schema.ts`; the process refuses to start on a missing or invalid value. "Secret" means the value must never be committed or logged.

| Variable | Required | Secret | Purpose |
|---|---|---|---|
| `NODE_ENV` | no (default `development`) | no | `development`, `test` or `production`. Production disables pretty logging and enables production checks. |
| `PORT` | no (default `4000`) | no | HTTP port. Render injects its own. |
| `PLATFORM_MODE` | no (default `docker`) | no | `docker` = local Postgres/Redis, own JWT auth, Socket.IO. `supabase` = Supabase Postgres/Auth/Realtime/Storage. |
| `DATABASE_URL` | yes | **yes** (contains password) | Prisma connection string. Local: compose Postgres. Supabase: the Session-mode pooler string (not the IPv6-only direct host), plus `?connect_timeout=20`. |
| `REDIS_URL` | yes | **yes** if it has a password | Redis for BullMQ jobs and throttling. |
| `JWT_ACCESS_SECRET` | yes, min 32 chars | **yes** | Signs access tokens. `openssl rand -base64 48`. |
| `JWT_REFRESH_SECRET` | yes, min 32 chars | **yes** | Signs refresh tokens. Different from the access secret. |
| `JWT_ACCESS_EXPIRES_IN` | no (default `15m`) | no | Access token lifetime. |
| `JWT_REFRESH_EXPIRES_IN` | no (default `7d`) | no | Refresh token lifetime. |
| `ADMIN_SECURE_CODE` | yes, min 16 chars | **yes** | Extra code guarding admin bootstrap actions. `openssl rand -hex 32`. |
| `CORS_ORIGINS` | yes | no | Comma-separated allowlist of web origins. Never `*`. |
| `FRONTEND_URL` | no | no | Public base URL of the web app, used for links in emails and the admin status check. Falls back to the first CORS origin. Set it in production. |
| `RESEND_API_KEY` | no | **yes** | Preferred email transport (HTTPS). Used instead of SMTP when set. Render free tier blocks SMTP ports. |
| `SMTP_HOST` | no | no | SMTP fallback host. |
| `SMTP_PORT` | no | no | SMTP port (587 or 465). |
| `SMTP_USER` | no | **yes** | SMTP login. |
| `SMTP_PASSWORD` | no | **yes** | SMTP password. |
| `SUPABASE_URL` | only when `PLATFORM_MODE=supabase` | no | Supabase project URL. |
| `SUPABASE_SECRET_KEY` | only when `PLATFORM_MODE=supabase` | **yes** | Supabase `sb_secret_...` key; bypasses row-level security, server only. |
| `LOG_LEVEL` | no (default `info`) | no | pino level. Read directly by the logger, not in the schema. |

## Web variables (`apps/web/.env.example`)

| Variable | Required | Secret | Purpose |
|---|---|---|---|
| `API_INTERNAL_URL` | yes in deployed envs (default `http://localhost:4000`) | no | Server-side base URL of the backend; also the target of the `/api/*` and `/socket.io` rewrites. |
| `NEXT_PUBLIC_PLATFORM_MODE` | no (default `docker`) | no, but public | Must match the backend `PLATFORM_MODE`. |
| `NEXT_PUBLIC_SUPABASE_URL` | only for `supabase` | no, but public | Supabase project URL used by the browser client. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | only for `supabase` | no, but public | Supabase `sb_publishable_...` key. Public by design; protection comes from row-level security. **Never** put the secret key in a `NEXT_PUBLIC_` variable. |

Anything starting with `NEXT_PUBLIC_` is shipped to every visitor's browser.

## Deployment-only variable

`API_DOMAIN` in the root `.env.prod` (see `.env.prod.example`) is used only by the Caddy service in `docker-compose.prod.yml` (the VPS option).

## Starting from zero (new developer)

```bash
git clone <repo> && cd packetpulse-site
nvm use                      # Node 24
corepack enable && corepack prepare pnpm@9 --activate
pnpm install
docker compose up -d         # Postgres :5433, Redis :6380
cp apps/backend/.env.example apps/backend/.env
cp apps/web/.env.example apps/web/.env.local
```

Edit `apps/backend/.env` and fill the three secrets (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `ADMIN_SECURE_CODE`, commands are in the file). Everything else works as-is against the compose services.

```bash
cd apps/backend
pnpm prisma:migrate && pnpm prisma:seed
cd ../.. && pnpm dev          # backend :4000, web :3000
```

You do **not** need anything from Supabase, Render or Vercel to develop. If you are ever handed a `DATABASE_URL` for a hosted project, use it only to run the app deliberately, never for tests.

### Running the e2e tests safely

From `apps/backend`, with the compose containers up:

```bash
env DATABASE_URL=postgresql://packetpulse:packetpulse@localhost:5433/packetpulse \
    REDIS_URL=redis://localhost:6380 NODE_ENV=test PLATFORM_MODE=docker \
    SMTP_HOST= SMTP_USER= SMTP_PASSWORD= RESEND_API_KEY= pnpm test:e2e
```

The explicit `env` is needed because a `.env` file with a remote database would otherwise be picked up; the guard stops you if you forget. CI uses `localhost:5432` service containers and needs no override.

## Open questions for the owner

- Create the staging Supabase project, Render service and Vercel project? Free tiers exist for all three but each Supabase free project is limited in number.
- Preview deployments: point them at staging, or keep them frontend-only against a fixed staging backend?
- Who holds the production secrets as the owner of record (and where is the backup copy, e.g. a password manager)?

## Troubleshooting: every request from my machine takes about 5 seconds

Symptom: local dev against the remote database (or any remote host) is slow, `getent ahosts example.com` takes about 5 s, and the same `curl` is fast with `-4`. Cause: the glibc resolver sends IPv4 and IPv6 lookups in parallel, the network drops one reply, and it waits out its 5 s timeout. Prisma, `pg`, `fetch` and Next all resolve through the system resolver, so each new connection pays it.

Fix, per user: add `export RES_OPTIONS=single-request-reopen` to your shell profile and restart your terminals and dev servers. Check with `time getent ahosts example.com` (should be well under a second). This only affects local development; deployed environments resolve names normally. Details and measurements: [docs/research/12-session-and-latency-analysis.md](../research/12-session-and-latency-analysis.md).

