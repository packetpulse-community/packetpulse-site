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
