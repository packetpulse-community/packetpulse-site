# Multi-stage build, run from the monorepo root (docker-compose.prod.yml build.context: .)
# so pnpm workspace deps (packages/types) resolve correctly.

FROM node:24-alpine AS base
# Alpine's base image ships no system OpenSSL at all — Prisma's query engine
# needs one to detect its ABI target (openssl-1.1.x vs 3.0.x) both at `prisma
# generate` time and at runtime; without this it silently guesses wrong and the
# engine fails to load (caught by actually running the built image, not just
# building it — see binaryTargets comment in prisma/schema.prisma).
RUN apk add --no-cache openssl
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/types/package.json packages/types/
COPY packages/tsconfig/package.json packages/tsconfig/
COPY packages/eslint-config/package.json packages/eslint-config/
COPY apps/backend/package.json apps/backend/
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY packages/ packages/
COPY apps/backend/ apps/backend/
RUN pnpm --filter @packetpulse/types build
RUN pnpm --filter @packetpulse/backend exec prisma generate
RUN pnpm --filter @packetpulse/backend build

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /repo

# node_modules copied from `build`, not `deps` — `prisma generate` (run in the
# build stage) writes the generated client into @prisma/client's own package
# directory inside node_modules, not somewhere separate. Copying node_modules from
# `deps` (pre-generate) ships an ungenerated stub client that fails at import time
# with "Prisma.validator is not a function" (caught by actually running this image
# locally, not just building it — plan §11/testing discipline).
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/packages ./packages
COPY --from=build /repo/apps/backend/node_modules ./apps/backend/node_modules
COPY --from=build /repo/apps/backend/dist ./apps/backend/dist
COPY --from=build /repo/apps/backend/prisma ./apps/backend/prisma

WORKDIR /repo/apps/backend
EXPOSE 4000
CMD ["node", "dist/main.js"]
