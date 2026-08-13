# PacketPulse

Community platform for networking professionals — Next.js frontend, NestJS backend, Postgres (Supabase-compatible), Redis/BullMQ. pnpm + Turborepo monorepo.

```
apps/
  web/       Next.js 15 App Router frontend
  backend/   NestJS 10 modular-monolith backend
packages/
  types/     shared Zod schemas/DTOs used by both apps
  eslint-config/
  tsconfig/
```

## Prerequisites

- Node **24** (`.nvmrc` — run `nvm use` if you have nvm)
- pnpm 9 (`corepack enable && corepack prepare pnpm@9 --activate`)
- Docker (for local Postgres/Redis)

## 1. Install dependencies

```bash
pnpm install
```

## 2. Start local services

```bash
docker compose up -d
```

Starts Postgres on `localhost:5433` and Redis on `localhost:6380` (remapped off the standard ports to avoid clashing with anything already running locally — see `docker-compose.yml`).

## 3. Configure environment

```bash
cp apps/backend/.env.example apps/backend/.env
cp apps/web/.env.example apps/web/.env.local
```

Then fill in `apps/backend/.env`:
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` — generate with `openssl rand -base64 48`
- `ADMIN_SECURE_CODE` — generate with `openssl rand -hex 32`

The rest of the defaults match the `docker compose` services above and work as-is for local dev. Never commit real values in these files — only `.env.example` is tracked.

## 4. Set up the database

```bash
cd apps/backend
pnpm prisma:migrate   # applies migrations
pnpm prisma:seed      # seeds default roles/permissions
cd ../..
```

## 5. Run the apps

```bash
pnpm dev
```

Runs both apps in parallel via Turborepo:
- Backend: http://localhost:4000/api (health check: `/api/health`)
- Frontend: http://localhost:3000

Or run one at a time:

```bash
pnpm --filter @packetpulse/backend dev
pnpm --filter @packetpulse/web dev
```

## Other commands

```bash
pnpm build       # build all apps
pnpm lint        # lint all apps/packages
pnpm typecheck   # typecheck all apps/packages
pnpm test        # unit tests

cd apps/backend
pnpm test:e2e    # e2e regression suite (needs Postgres/Redis running)
```

## Stopping local services

```bash
docker compose down
```

## Deployment

**Backend** (`apps/backend`) ships as a Docker image (`apps/backend/Dockerfile`, multi-stage, built from the repo root as context) behind Caddy for TLS/reverse-proxy on a single VPS:

```bash
docker compose -f docker-compose.prod.yml up -d
```

Requires, once, on the VPS before first run:
- DNS for your API domain pointed at the VPS
- `.env.prod` at the repo root (copy from `.env.prod.example`) with `API_DOMAIN` set
- `apps/backend/.env.prod` (copy from `apps/backend/.env.example`) with real production secrets

And once, after first `up -d`:
```bash
docker compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy
docker compose -f docker-compose.prod.yml exec backend node dist/../prisma/seed.js  # or re-run via ts-node if available
```

`DATABASE_URL` can point at either a Supabase-cloud project or a self-hosted Postgres — see the comment in `apps/backend/.env.example`. Swapping between them is a one-line env change plus a re-run of `prisma migrate deploy`, no code changes.

**Frontend** (`apps/web`) deploys to [Vercel](https://vercel.com) separately, decoupled from the VPS — connect the repo, set the root directory to `apps/web`, and set `API_INTERNAL_URL` to the backend's public URL in Vercel's project env vars.

**Not yet done** (needs real infrastructure/accounts, not just code):
- VPS provisioning and DNS
- Vercel project creation/linking
- Generating and storing real production secrets

CI (`.github/workflows/ci.yml`) builds and smoke-tests the production Docker image on every PR against real Postgres/Redis service containers, so a build that looks fine but fails to actually boot (as happened once during development — see git history) can't land silently.
