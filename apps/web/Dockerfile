# Fallback only — apps/web deploys to Vercel by default (plan §8), this Dockerfile
# exists so containerizing it later isn't a from-scratch job if Vercel ever becomes
# a blocker. Not referenced by the active services in docker-compose.prod.yml.

FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/types/package.json packages/types/
COPY packages/tsconfig/package.json packages/tsconfig/
COPY packages/eslint-config/package.json packages/eslint-config/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY packages/ packages/
COPY apps/web/ apps/web/
RUN pnpm --filter @packetpulse/types build
RUN pnpm --filter @packetpulse/web build

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /repo/apps/web

COPY --from=build /repo/apps/web/.next ./.next
COPY --from=build /repo/apps/web/public ./public
COPY --from=build /repo/apps/web/package.json ./
COPY --from=build /repo/node_modules /repo/node_modules

EXPOSE 3000
CMD ["node_modules/.bin/next", "start", "-p", "3000"]
