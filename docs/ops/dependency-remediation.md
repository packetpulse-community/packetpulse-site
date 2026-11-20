# Dependency remediation (TASK-011, dependency part)

Scope: `pnpm audit --prod` across the monorepo (production dependencies only; 645 packages).
Date: 2026-11-20. Branch: `feat/2.0-stabilise`.

## Result

| | critical | high | moderate | low |
|---|---|---|---|---|
| Before (start of TASK-011) | 7 | 36 | 53 | 5 |
| After the same-major fixes | 0 | 7 | 35 | 1 |
| **After nodemailer 10 and bcrypt 6** | **0** | **2** | 19 | 0 |

The 2 remaining highs both need a **major-version upgrade the owner deferred**: `zod` 3 -> 4 and `@opentelemetry/propagator-jaeger`
(via `@opentelemetry/sdk-node` 0.55 -> 2.x). So the CI `dependency-audit` job **can be made blocking at
`--audit-level=critical` today** (0 critical) and **cannot yet be blocking at `--audit-level=high`** (2 high) unless the owner
accepts zod and OpenTelemetry as a documented exception (`pnpm.auditConfig.ignoreGhsas` with the advisory IDs and a dated
reason) or schedules those two upgrades. Both are low reachability (see the table).

Commits (one per group): compression bump; `pnpm.overrides` for same-major transitives; Next.js 16.3.0 -> 16.4.6; `tar` override (later removed); nodemailer 6 -> 10; bcrypt 5 -> 6.

## Advisory table (high and critical, as found before the work)

"Reachable?" is our judgement for how PacketPulse uses the package, not the advisory's general severity.

| Package (installed) | Patched | Direct / transitive (workspace) | What it allows | Reachable in our use? | Status |
|---|---|---|---|---|---|
| next 16.3.0 (5 critical, 2 high) | 16.3.3 to 16.4.1 | direct (apps/web) | Unauthenticated RCE in image optimization, `use cache`, `next/og`; SSRF in image optimization; Server Actions DoS | Yes: public Vercel app, `next/image` used | **Fixed**: 16.4.6 |
| sharp 0.35.3 (2 high) | 0.35.4 / 0.35.5 | transitive via next (apps/web) | libheif / librsvg memory-safety flaws when decoding crafted images | Only through image optimization | **Fixed**: 0.35.5 came with next 16.4.6 |
| source-map-js 1.2.1 | 1.2.2 | transitive via next > postcss | Event-loop DoS on crafted source maps | Build time only | **Fixed**: override |
| proxy-addr 2.0.7 (critical) | 2.0.8 | transitive via express (backend) | IP spoofing via IPv4-mapped IPv6 trust-proxy subnets | Yes if `trust proxy` is set (Render): affects `req.ip`, rate-limit keys, login lockout | **Fixed**: override ^2.0.8 |
| body-parser 1.20.4 | 1.20.9 | transitive via express (backend) | DoS via trailing bytes after the body | Yes, every JSON route | **Fixed**: override |
| multer 2.0.2 (7 high) | 2.5.0 | transitive via @nestjs/platform-express | Several DoS flaws in multipart parsing | **No**: no upload route exists (`FileInterceptor` is not used in `apps/backend/src`) | **Fixed**: override (hygiene) |
| compression 1.8.1 | 1.8.2 | direct (backend) | Memory leak when the client disconnects mid-response | Yes, all responses | **Fixed**: ^1.8.2 |
| engine.io 6.6.9 | 6.6.10 | transitive via @nestjs/websockets | Protocol-revision mismatch DoS | Only if a Socket.IO gateway is started; none in use | **Fixed**: override |
| lodash 4.17.21 | 4.18.0 | transitive via @nestjs/config | Code injection through `_.template` import keys | No: we never pass untrusted input to `_.template` | **Fixed**: override |
| @grpc/grpc-js 1.14.4 | 1.14.5 | transitive via terminus / OpenTelemetry exporters | `getAuthContext` can return unauthenticated context in some configs | Only if OTLP-gRPC export is configured | **Fixed**: override |
| brace-expansion 1.1.18 and 5.0.9 (4 high) | 1.1.20 / 5.0.11 | transitive via bcrypt install chain; eslint-config (dev tooling) | Regex-style DoS on crafted patterns | No: build/lint only | **Fixed**: override |
| tar 6.2.1 (1 critical, 8 high) | 7.5.21+ | transitive via bcrypt > node-pre-gyp (backend) | Path traversal, link overwrite, parse DoS when unpacking a hostile archive | **Install time only**, and the archive is bcrypt's own release tarball from GitHub | **Fixed**: override, then **removed** once bcrypt 6 dropped node-pre-gyp and tar (see below) |
| nodemailer 6.10.1 (5 high) | 10.0.6 and later | direct (backend, `mailer.service.ts`) | addressparser quadratic/recursive DoS; OAuth2 token-fetch TLS validation; `raw` option bypassing `disableFileAccess` | Low: we call `createTransport` (SMTP) and `sendMail({from,to,subject,text})` only. No OAuth2, no `raw`, no attachments. The address-parser DoS is reachable through user-supplied recipient addresses, but they pass zod email validation and a body-size limit first | **Fixed**: nodemailer 10.6.1 (see below) |
| zod 3.25.76 | 4.6.6 | direct (types, backend, web); transitive via nestjs-zod | Memory exhaustion validating oversized constrained collections | Low: request body size is capped; only matters for schemas with array/record constraints on large payloads | **Open**: needs major 3 -> 4 |
| @opentelemetry/propagator-jaeger 1.28.0 | 2.9.0 | transitive via @opentelemetry/sdk-node 0.55 (backend) | DoS in `JaegerPropagator` via crafted trace headers | Only if the Jaeger propagator is enabled (`OTEL_PROPAGATORS=jaeger`); the default is W3C trace-context. It is not set in this repo | **Open**: needs OTel SDK 2.x |

Moderate and low advisories were not triaged here beyond the side effects of the above.

## What was changed and how it was verified

1. **compression ^1.8.2** (`apps/backend/package.json`). All other in-range direct dependencies were already at their newest same-major version (NestJS 10.4.22, terminus 10.3.0, config 3.3.0), so no other "patch/minor" updates existed.
2. **`pnpm.overrides` in the root `package.json`**, written as `pkg@<patched` range selectors so they never downgrade and expire on their own once upstream catches up: body-parser, proxy-addr, multer, engine.io, lodash, @grpc/grpc-js, brace-expansion (1.x and 5.x), source-map-js.
3. **Next.js 16.3.0 -> 16.4.6** (`apps/web/package.json`, exact pin as before). No source change needed.
4. **tar override `^7.5.21`**. tar 7 is a major above what `@mapbox/node-pre-gyp@1.0.11` declares, so it was tested where it matters: a clean `docker build` with `--frozen-lockfile` fetched and extracted bcrypt's musl binary through tar 7 (log: `extracted file count: 1 ... ok`) and `bcrypt.hashSync/compareSync` works in the built image.

After every group: `packages/types` tsc; backend `nest build`, tsc, eslint; full backend e2e (137 pass, local Docker Postgres and Redis only); web tsc, eslint, `next build` (42/42 pages); netsim vitest (34 pass), tsc, eslint. Final production image built like CI (`docker build -f apps/backend/Dockerfile`), run with `--network host` against the local DB and Redis using the CI env vars: `/api/health` returned `{"status":"ok", database up}`; container stopped and removed.

## Done after the owner chose to continue: nodemailer 10 and bcrypt 6

### nodemailer 6.10.1 -> 10.6.1 (own commit)

Changelog for 7, 8, 9 and 10 against our one use (`createTransport` with host, port, `secure: port === 465`, `connectionTimeout`,
`auth`; `sendMail` with from, to, subject, text):

| Major | Breaking change | Touches us? |
|---|---|---|
| 7 | SES transport moved to the SESv2 SDK | No (SMTP only) |
| 8 | Error code `NoAuth` renamed `ENOAUTH`; DNS fallback tries alternative addresses of a host | No: we read only `responseCode`. The DNS fallback is a behaviour improvement |
| 9 | HTTPS fetches (attachment URLs, OAuth2 token endpoint, HTTP/HTTPS proxy CONNECT) validate TLS certificates by default | No: none of those features are used. SMTP TLS behaviour is unchanged |
| 10 | Node >= 20; rewritten in TypeScript with ESM and CJS builds | Node 24 is fine; the CJS build loads from the Nest build; `@types/nodemailer` 6 still type-checks (left in place, can be dropped later) |

`mailer.service.ts` needed **no change**. New `apps/backend/test/mailer.e2e-spec.ts` (7 tests, no real network): options built for
port 587, 465 and the default; a full SMTP conversation (AUTH PLAIN, MAIL FROM, RCPT, Subject, From, body) against an in-process
sink on 127.0.0.1; 5xx rejection is permanent and a refused connection is retryable; Resend branch chosen over SMTP and never builds
an SMTP transport (fetch mocked); Resend 4xx/429/5xx permanence; dev and production behaviour with nothing configured.
A scratch script confirmed 6.10.1 and 10.6.1 behave the same for a 550 RCPT rejection (`EENVELOPE`, `responseCode` 550) and for AUTH
advertised without credentials (`EAUTH`), so retry classification is unchanged.

### bcrypt 5.1.1 -> 6.0.0 (own commit)

bcrypt 6 installs a prebuilt binary through `node-gyp-build`, so `@mapbox/node-pre-gyp` and `tar` are gone from the tree (24 lockfile
packages removed) and the `tar@<7.5.21` override was **deleted**; `pnpm install` afterwards, nothing else needed it. `hash` and
`compare` are unchanged (Node >= 18). `@types/bcrypt` moved to ^6.0.0 to match. New `apps/backend/test/bcrypt.e2e-spec.ts`: a hash
literal made by bcrypt 5.1.1 verifies (and a wrong password fails), a new hash round trips with `$2b$` and the cost kept, and
`LocalCredentialProvider` (cost 12) creates, verifies and rejects. The production image builds on `node:24-alpine`
(`docker build -f apps/backend/Dockerfile`, with `--frozen-lockfile`); run with `--network host` against the local DB and Redis and the CI
variables, `/api/health` returned ok with database up, bcrypt verified the bcrypt 5 hash inside the container, the image contains
no tar or node-pre-gyp. Container stopped and removed.

Checks after both: `packages/types` tsc; backend `nest build`, tsc, eslint; full backend e2e **154 tests pass** (144 + 7 mailer + 3
bcrypt), local Docker Postgres and Redis only; web tsc, eslint, vitest (125), `next build` (43/43 pages); netsim vitest (34).

## Behaviour to watch in production

- **proxy-addr 2.0.8**: IPv4-mapped IPv6 addresses (`::ffff:1.2.3.4`) are now matched against trusted-proxy subnets correctly, so `req.ip` behind Render could differ from before for such clients. Rate-limit and lockout keys use `req.ip`. Check a login and a throttled endpoint after deploy.
- **Next 16.4.6** on Vercel: smoke-check `next/image` pages and the `proxy.ts` middleware on the preview deployment.
- **nodemailer 10** (Render email path): the SMTP options we pass are unchanged and the socket/TLS handshake code is the same family, but email is only truly exercised in production. Watch the email queue processor logs for `MailDeliveryError` right after deploy (a TLS or connection-timeout change would show as "Connection timeout" or a certificate error, not as a 5xx). New in 8: if a host resolves to several addresses nodemailer now falls back to the next one on failure.
- **bcrypt 6** (Render install): the build downloads nothing now; it uses the prebuilt binary shipped in the package. If the Render build fails at the bcrypt install step, the log will say node-gyp-build found no prebuild for the platform (the Dockerfile on Alpine/musl was verified). Stored hashes need no migration.
- **Owner smoke test after deploy**: (1) send one real email through the real provider (trigger a password reset or verification email, confirm it arrives and the queue job succeeds); (2) log in with an existing account (verifies an old bcrypt 5 hash) and register a new one.

## Remaining: major upgrades the owner deferred (zod 3 -> 4, OpenTelemetry)

| Upgrade | Clears | Breaking changes to expect | Effort | Risk | Recommendation |
|---|---|---|---|---|---|
| **zod 3 -> 4** (also needs nestjs-zod 5, the `@packetpulse/types` package, and web usages) | 1 high | Error shape (`ZodError.issues` formatting, `.format()`/`.flatten()`), `z.string().email()` etc. moved to top-level validators, `.default`/`.optional` semantics, `z.record` requires two args, `ZodEffects` removed, nestjs-zod DTO and OpenAPI helpers changed. Touches shared types, every DTO and the web forms | Large (1 to 3 days; wide blast radius) | Medium to high: validation behaviour and the TASK-010 error format depend on zod error shape | Defer; low reachability. Accept as a documented exception, or schedule with the nestjs-zod upgrade |
| **OpenTelemetry SDK 0.55 -> current 2.x line** (`@opentelemetry/sdk-node` 0.301, `auto-instrumentations-node`) | 1 high | SDK 2.0 drops old Node versions, changes `Resource` and span-processor APIs; pre-1.0 package versions move in lockstep so all `@opentelemetry/*` must be bumped together; env var handling changes | Medium (about 1 day) | Medium: tracing is optional, but a broken bootstrap can stop the app starting | Defer, or simply confirm `OTEL_PROPAGATORS` never includes jaeger and accept |

Not needed for any advisory (so not proposed): NestJS 10 -> 11, Prisma 5 -> 6, React or Tailwind majors.

## Making the CI audit blocking

- Today: `pnpm audit --prod --audit-level=critical` passes (0 critical). `--audit-level=high` fails with 2 high (zod 3, `@opentelemetry/propagator-jaeger`); 19 moderate remain (mostly other `@opentelemetry/*` instrumentations, `qs`, `file-type`, `uuid`, `minimatch`, `@nestjs/core`, `fast-copy`).
- To block on high: either the zod and OTel upgrades or an explicit allow-list for the two (`pnpm audit` has no per-advisory ignore; use `pnpm.auditConfig.ignoreGhsas` with the advisory IDs and a dated reason).
- CI was not edited (`.github/workflows/ci.yml` is out of scope for this task).
