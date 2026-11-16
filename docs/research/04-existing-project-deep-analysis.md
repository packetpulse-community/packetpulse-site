# 04. Existing Project: Deep Analysis

Part of the [research pack](00-index.md). Builds on [Doc 01](01-context.md) and [Doc 02](02-gap-analysis.md) with a code-level review of PacketPulse 1.x at HEAD `dc44af1` (branch `feat/platform-mode-supabase`). Paths are relative to the repo root.

**How this was done.** I read the auth, token, guard, quiz, realtime, admin, user-deletion and web data-layer code in full, grepped every module for patterns, and read the schema, CI and deploy files. I did not run the app or its tests. Findings marked **Confirmed** were read directly in code; **Likely** means the logic reads as a bug but needs a failing test to prove it; each has a suggested test. Section 11 lists what was not read.

## 1. Verdict in one page

| Dimension | Rating | One-line reason |
| --- | --- | --- |
| Architecture | Strong | Clean modular monolith, DI-swappable infrastructure, shared Zod types between web and API |
| Auth foundations | Strong with gaps | Hashed rotating refresh tokens with reuse detection, httpOnly cookies, approval and verification guards; weak spots in the reset flow and OTP guessing |
| Authorization | Good | Permission-based guard chain on every route by default; ownership checks present; coverage untested |
| Data model | Good, with dangerous deletes | Sensible relational design; several cascades destroy issued credentials and other people's content |
| Quiz and certificate integrity | Weak | No attempt cap, no timer enforcement, certificates cascade-deleted with quizzes, a likely draft leak on a public route |
| Privacy and erasure | Weak | Account deletion leaves the Supabase login behind and cascades through other users' replies; no export; placeholder policy |
| Frontend | Fair | Sound server-side auth and data fetching; design system and accessibility are the weakest layer |
| Testing | Weak | 9 end-to-end cases, 0 unit tests |
| Operations | Fair | Excellent CI and image smoke test; free-tier hosting, two deployment paths, no alerting |
| Documentation | Weak | Code comments cite a "plan §N" document that is not in the repo; README stale |

**Bottom line.** The foundations are better than the size of the codebase suggests: someone made careful, security-aware choices and left detailed comments explaining old-app bugs they fixed. The risks are concentrated in four places: quiz and certificate integrity, deletion semantics, password reset, and the absence of tests around all of it. These matter more than usual because 2.0 builds "verified skills" directly on top of quizzes and certificates.

## 2. History and delivery pattern

| Fact | Value | Evidence |
| --- | --- | --- |
| Commits | 56, all by one author | `git log` |
| Span | Aug to Oct 2026: 15 in August, 26 in September, 15 in October | `git log --date=format:%Y-%m` |
| Mix | 30 `feat`, 15 `fix`, rest chore or docs | commit prefixes |
| Origin | Rebuild of an older Mongo and Express app ("old app") onto Postgres, NestJS, Next.js | schema comments, `scripts/migrate-mongo-to-postgres.ts` |
| Phases | 1 identity, 2 content, 3 forums and quizzes, 5 notifications and realtime, then admin, Supabase platform mode, maintenance mode, logs | schema header, migration names |
| Latest work | Email delivery hardening (Resend over HTTPS, send logging), session renewal, visitor IP forwarding, health check timeout, no localhost links in emails | last five commits |

**Reading the pattern.** The last month is almost entirely production-hardening fixes found on a live deployment on Render's free tier (SMTP blocked, cold-start timeouts, shared-IP rate limits, 15-minute session lapse). That is healthy, and it also means the product is already being used in earnest, so any 2.0 change has to be additive (RISK-05).

## 3. Architecture deep dive

### 3.1 Runtime topology

```
Browser ──▶ Vercel (Next.js 16, SSR + static)
              │  rewrite /api/*, /socket.io/*  (same-origin so cookies land on the web origin)
              ▼
         Render (NestJS 10, Docker, free plan, Singapore)
              ├── Postgres  (Supabase in prod, local Docker in dev)  ◀─ Prisma
              ├── Redis     ◀─ BullMQ queues (email, fan-out), realtime pub/sub, presence set
              ├── Supabase  (Auth credentials, Storage, Realtime) when PLATFORM_MODE=supabase
              └── Resend (HTTPS) or SMTP for email
SSR path: Next server ──▶ backend directly (INTERNAL_API_URL), forwarding Cookie and X-Forwarded-For
```

Two things worth noting. The browser never calls the backend cross-origin (the Next rewrite makes it same-origin), which keeps cookies simple and CORS nearly irrelevant for the web app. And server components call the backend directly, forwarding the visitor's IP so per-IP rate limits stay meaningful.

### 3.2 Request pipeline (backend)

Global guards in order: **Throttler (300/min default) → JWT → Maintenance → Roles (permission) → Approved**. Every route is protected unless marked `@Public()`; permissions are declared per route with `@RequirePermission`. `super_admin` bypasses permission checks. `ApprovedGuard` reads the database each request to check `isApproved` and `emailVerified`, and lets `admin` and `super_admin` through unconditionally.

This is a good default-deny design. It is also why untested routes matter less than in most codebases: forgetting a decorator results in "authenticated and approved only", not "open to the world".

### 3.3 Authentication and sessions

| Piece | Behaviour | Assessment |
| --- | --- | --- |
| Credentials | Own bcrypt hash in Postgres (docker mode) or Supabase Auth (supabase mode), behind a `CredentialProvider` | Clean seam |
| Access token | JWT, 15 min, carries `roles` and `permissions` snapshot | Role changes take up to 15 min to apply (except approval, re-read each request) |
| Refresh token | 48 random bytes, stored as SHA-256, rotated on use, family revoked on reuse, 7 days | Best-practice |
| Cookies | httpOnly, `sameSite=lax`, `secure` in prod, plus a readable `session_active` presence flag | Good; the presence flag is explicitly not trusted |
| Renewal | `proxy.ts` sends a signed-in visitor with an expired access cookie through `/refresh`, which renews client-side | Solves the 15-minute lapse; adds a redirect hop |
| Login gating | Password verified first, then maintenance, approval, email checks, so messages do not reveal which emails exist | Good, with the timing caveat in S-13 |
| Password reset | 6-digit OTP (10 min), then a temp token | See S-2 and S-3 |
| Admin creation | Public endpoint gated by a shared `ADMIN_SECURE_CODE` | See S-4 |

### 3.4 Background and realtime

BullMQ processors send email and fan out content announcements. Notifications are written to Postgres and pushed over Socket.IO rooms (`user:{id}`) via a Redis pub/sub channel, designed so multiple backend replicas work. Presence is a Redis set; the source documents a crash caused by a wrong `Namespace` type and the try/catch added after it. Delivery is not logged per message beyond the recent "log every email send and failure" commit.

## 4. Backend, module by module

| Module | Purpose | Notable behaviour | Strengths | Weaknesses |
| --- | --- | --- | --- | --- |
| identity | Auth, sessions, roles, approval and verification guards | Strategy and provider abstractions; decorators `@Public`, `@RequirePermission`, `@SkipApproval` | Rotation with reuse detection; error messages avoid enumeration after password check | S-2, S-3, S-4, S-13; no MFA; 8-char complexity policy |
| users | Own profile, password change, account deletion | Password change revokes all sessions and emails a notice | Re-auth for delete and change | S-5: delete does not remove the Supabase credential and cascades widely |
| admin | Approvals, roles, moderation, settings, analytics, activity, clean-data, system status | 25 routes, all permission-gated and throttled with an admin tier | Consistent gating; audit rows for approvals and moderation | S-6 clean-data unaudited; no reason capture; no suspend; no bulk approve |
| blogs | Posts, comments, likes, tags, images | `isApproved` defaults true (moderation is opt-in) | Public reading with slugs; content rendered as text (no `dangerouslySetInnerHTML` anywhere in the repo) | No draft or review state; no comment moderation queue; no report |
| resources | Library of files and links, premium flag | Admins see unapproved items | Pagination, filters, tags, likes, download counter | Public storage URLs; `fileUrl` is a client-supplied string, not an upload path in this module (inferred) |
| recordings | Session videos with instructor and participants | Approval gate, premium flag | Similar to resources | `RecordingParticipant` is the only "enrollment"; no progress |
| forums | Categories, threads, nested replies, reply likes, pin and lock | Ownership or moderator rules on edit and delete | Reasonable moderation hooks | No report, accepted answer, follow, mode, length minimums; reply count is a denormalized cache |
| quizzes | Authoring, taking, scoring, certificates, public verification | Answer key stripped from the taking view; exact-match scoring in a transaction | Good authoring split (taking versus authoring views) | S-1, S-7, S-8, S-9 |
| notifications | In-app, email queue, fan-out, content announcements | Six notification types, BullMQ | Decoupled from request path | No preferences, quiet hours, per-message log, WhatsApp |
| realtime | Socket.IO gateway, presence | Cookie-authenticated | Redis-backed, replica-safe | S-10 |
| categories | Shared, admin-editable content categories | Used by blogs, resources, recordings, quizzes, forums | One list, no enum migrations | Not a skills taxonomy |
| dashboard | Stats for the member dashboard | Real counts plus a simulated "snapshot" | | Simulated values presented beside real ones |
| network-tools | Ping, traceroute, DNS, port-scan | Deterministic seeded random output | Honest comment about why it is not real | Output is fake; this is the natural seat of the Packet Lab (Doc 05) |
| logs | Client-error ingestion and admin viewer | `ClientLog` table | Useful RUM-lite | Unbounded table with no retention policy |

## 5. Data model analysis

36 models, 10 migrations, UUID keys, `@map` snake-case columns, indexes on the main query paths (`[isPublished, postedAt]`, `[categoryId, lastReplyAt]`, `[userId, readAt, createdAt]`).

**Good decisions.** Relational join tables instead of embedded arrays; hashed tokens; token families; a shared `Category` table; the activity log's actor is `SetNull` so the audit trail survives an admin's deletion; fixed-shape `UserSocialLinks` instead of a JSON blob; the Prisma comments explain each trade-off.

**Problems.**

| # | Issue | Evidence | Consequence |
| --- | --- | --- | --- |
| D-1 | `Certificate.quiz` and `QuizAttempt.quiz` cascade on delete | `schema.prisma` | Deleting a quiz destroys every certificate issued from it, including ones members have shared with employers. The public verifier then says "Certificate Not Found" |
| D-2 | `User` cascades to forum threads, replies, blog posts, resources, recordings, quiz attempts, certificates | `onDelete: Cascade` on each | Deleting one author removes entire threads, including other members' replies in them. Doc 1 s10.7 wants posts kept and the name removed |
| D-3 | No `status` or `suspended` on `User` | model | Cannot suspend; only approve, unapprove or delete (SCR-D05 needs suspend) |
| D-4 | No attempt count, `expiresAt` or `version` on `Quiz` and `QuizAttempt` | model | Cannot enforce PRD-017 rules; `expired` status exists but nothing sets it |
| D-5 | `AdminActivityLog.action` is a closed enum of 18 values; `details` is free JSON with no required `reason` | enum | New admin action types need a migration; PRD-043 wants a reason and policy version |
| D-6 | `ClientLog` has no TTL | model | Grows without bound |
| D-7 | `SiteSettings.adminEmail` defaults to a personal Gmail address in the schema | `schema.prisma` | Real contact data lives in a default |
| D-8 | `Notification.type` is an enum and `payload` is JSON | model | Fine now; the 2.0 notification events (interviews, offers) will need many more types |
| D-9 | `UserCertification` (self-entered) and `Certificate` (earned) are separate and unrelated | models | Two meanings of "certificate" will confuse the evidence model; unify under an evidence record in 2.0 |

## 6. Frontend deep dive

### 6.1 Structure and data flow

Next.js App Router with route groups `(auth)`, `(protected)`, `(admin)`. Features are organised under `features/<domain>/{api,components}`; shared primitives sit in `shared/`. Server components resolve the user from the cookie (`getCurrentUser`) and call the backend directly; client components use TanStack Query. Types come from `@packetpulse/types`, so the web and API agree on payload shapes at compile time. Protected layouts redirect before render rather than flashing a client-side redirect.

### 6.2 Observations

| Area | Finding |
| --- | --- |
| Auth UX | Solid server-side enforcement; the `/refresh` bounce is clever but adds a visible redirect for returning visitors |
| Rendering | Mostly server-rendered pages calling the API on each request; the protected layout calls `/auth/me` and the page calls its own endpoints, so every navigation costs at least two backend round trips to a free-tier host |
| State | React Query for mutations and client fetches; a few hand-rolled forms (new-thread) bypass React Hook Form and Zod |
| Realtime | `useRealtime` opens one socket through the same-origin proxy |
| Admin | Large feature area (37 admin components) with its own shell and tables; consistent but dense |
| Design system | 10 primitives plus per-page utility classes; the visual identity is in class names (see [Doc 03](03-ux-research-analysis.md)) |
| Accessibility | Weak: see Doc 03 s4 |
| i18n and theming | None |
| Bundle | framer-motion, cmdk, socket.io-client, supabase-js (used only for realtime) all ship; not measured |

## 7. Security review

Severity is the likely worst case for a live site with about 2,000 members. "Fix" is the smallest change that closes it. Each item should get a regression test in the e2e suite before it is fixed.

| ID | Severity | Status | Finding | Evidence | Fix |
| --- | --- | --- | --- | --- | --- |
| S-1 | High | Likely | **Anonymous visitors may see unpublished quizzes.** `GET /quizzes` is `@Public()`. For an anonymous call `userId` is `undefined`, so the filter becomes `OR [{isPublished:true},{createdById: undefined}]`. Prisma treats `undefined` as "no condition", so the second clause matches every row | `quizzes.controller.ts:24`, `quizzes.service.ts` `list` | Build the `OR` only when `userId` is set; otherwise filter `isPublished: true`. Test: anonymous list returns zero drafts |
| S-2 | Medium | Confirmed | **Password-reset temp token never expires and is never invalidated.** `resetPassword` checks only that the hash matches and `consumedAt` is set. After a successful reset the record is unchanged, so the token works again indefinitely | `auth.service.ts` `verifyOtp`, `resetPassword` | Check `expiresAt`, mark the record used on reset, make the token random rather than derived from `Date.now()` |
| S-3 | Medium | Likely | **The 6-digit reset code can be guessed.** There is no per-account attempt counter. The only limit is 5 per 15 minutes per IP, and `trust proxy` is `true`, so a caller who reaches the backend directly can vary `X-Forwarded-For` to get fresh budgets. One million codes against a 10-minute window is feasible at high request rates | `auth.controller.ts:26`, `main.ts` `trust proxy` | Count failed attempts per user and lock the code after 5; restrict the backend to Vercel and Render's proxy (trust only known hops); lengthen or replace the OTP with a signed link |
| S-4 | High | Confirmed | **Anyone holding one shared secret can create an admin.** `registerAdmin` creates an auto-approved, auto-verified admin from a shared code, with no per-person approval, no MFA and no audit row | `auth.service.ts` `registerAdmin` | Replace with invitation by an existing SuperAdmin; add MFA for staff (PRD-042); log the creation |
| S-5 | High | Confirmed | **Deleting an account does not remove the Supabase login and cascades through shared content.** `CredentialProvider` has no delete method, so in supabase mode the credential remains: the person cannot re-register with that email and the old password still works at the Supabase layer. The database delete then cascades per D-2 | `credential-provider.ts`, `users.service.ts` `deleteAccount`, `admin-users.service.ts` `delete` | Add `deleteCredential` to the provider; change D-2 to anonymise or `SetNull` for shared content; add a grace period (SCR-038) |
| S-6 | Medium | Confirmed | **Admin "clean data" permanently deletes certificates, quiz attempts and forum posts with no audit entry.** The service logs nothing and the action enum has no value for it | `admin-clean-data.service.ts`, `admin.controller.ts:113` | Add audit actions with a reason; soft-delete or revoke certificates (`revokedAt` already exists) |
| S-7 | Medium | Confirmed | **Quizzes can be retaken without limit and the timer is not enforced.** `start` creates an attempt every time; `submit` does not compare against `timeLimitSeconds`; `expired` is never set. A member can probe answers by repeated attempts and collect a certificate for each pass | `quiz-attempts.service.ts` | Attempt cap and retake gap (Doc 1 s10.2), server-side deadline on submit, expiry job |
| S-8 | Low | Confirmed | **Certificate numbers are guessable and the public verifier shows a real name.** `PP-<timestamp base36>-<3 random bytes>` has 24 bits of randomness; `/certificates/verify/:number` is public and returns first and last name | `quiz-attempts.service.ts`, `quizzes.controller.ts:37` | 80-bit random identifier, rate-limit the verifier, show the name only with the member's consent (PRD-010) |
| S-9 | Medium | Confirmed | **Certificates are lost with the quiz** (D-1) | schema | Restrict delete when certificates exist; archive instead |
| S-10 | Low | Confirmed | **Realtime gateway allows any origin with credentials** and checks the token only at connect; a revoked or unapproved user keeps a live socket until it drops. `sameSite=lax` limits cross-site cookie use | `realtime.gateway.ts` | Use the same origin allowlist as HTTP; re-check on connect for approval; disconnect on revoke |
| S-11 | Medium | Confirmed | **`trust proxy: true` plus a publicly reachable backend lets clients spoof their IP** and dodge every per-IP limit. The source comment names this trade-off | `main.ts` | Trust only the proxy hops you control; put the backend behind an allowlist; add per-account limits |
| S-12 | Low | Confirmed | Storage returns public URLs (`getPublicUrl`) | `supabase-storage.provider.ts` | Signed URLs before any private upload (resumes, evidence) |
| S-13 | Low | Confirmed | Login returns early when the email does not exist, before any password work, so response time reveals registered emails. Registration also returns 409 for existing emails | `auth.service.ts` | Run a dummy hash on the unknown-user path; accept registration enumeration as common practice |
| S-14 | Info | Confirmed | Access token carries a permissions snapshot (15 min), and `ApprovedGuard` queries the database on every request | `token.service.ts`, `approved.guard.ts` | Acceptable now; cache the approval flag in Redis if load grows |
| S-15 | Info | Confirmed | Admins and SuperAdmins bypass the approval and verification check, with no suspend path | `approved.guard.ts` | Add suspension (D-3) and apply it to everyone |

**What is done well** (so it is not undone by accident): rotating refresh tokens with reuse detection and family revocation; hashed token storage; httpOnly secure cookies; helmet; Zod validation on every route; default-deny guard chain; answer keys never sent to quiz takers; ownership checks on quizzes and forum content; no raw HTML rendering; strict CORS allowlist for HTTP; env validation at boot; password change revokes sessions and emails a notice.

## 8. Quality, testing and delivery

| Area | State |
| --- | --- |
| CI | Lint, typecheck, build, migrate, seed, unit, e2e against real Postgres and Redis, Docker build, container smoke test. Unusually good for the size |
| Tests | 9 e2e cases: registration state, no rehash on profile update, wrong password, approval revocation blocks a live session, refresh rotation with reuse revocation, maintenance mode, pending login without email, unverified login re-sends link. Strong choices of what to test; narrow coverage |
| Unit tests | None in either app; web `vitest --passWithNoTests` |
| Not covered | Every content module, quizzes and certificates, admin actions, forums permissions, realtime, notifications, password reset, uploads |
| Types | Strict TypeScript with shared Zod schemas; good |
| Lint | ESLint 9 shared config |
| Docs | Comments cite "plan §N" and "platform-mode plan" documents that are not in the repository; README says Next 15 and an `ADMIN_SECURE_CODE` step but not the Supabase mode |
| Migrations | 10 reviewable migrations plus a Mongo-to-Postgres script |

**Recommendation:** write the S-1, S-2, S-3, S-5, S-7 regression tests first. They are small, they prove or disprove the "Likely" items, and quizzes are about to carry 2.0's proof model.

## 9. Operations and cost

| Item | Finding |
| --- | --- |
| Hosting | Backend on Render's free plan (sleeps when idle, cold starts, blocks SMTP); web on Vercel. A second, unused path exists in `docker-compose.prod.yml` and `Caddyfile` (a VPS with Redis, Caddy and Supabase cloud). Two deployment definitions drift apart |
| Health | `/api/health` with a database ping timeout recently raised from 1 s to 5 s to survive cold starts |
| Observability | pino logs, a tracing bootstrap, client error ingestion, activity log; no error tracker, uptime monitor or alert routing found |
| Email | Resend over HTTPS preferred; SMTP fallback; every send and failure logged with a reason |
| Backups | Unknown; depends on the Supabase plan |
| Secrets | Env validated at boot; `.env` is git-ignored; `render.yaml` marks secrets `sync: false` |
| Scaling | Realtime and queues designed for replicas; the free plan runs one instance |

## 10. Prioritised technical-debt register

| Rank | Item | Why now | Size |
| --- | --- | --- | --- |
| 1 | Regression tests for S-1, S-2, S-3, S-5, S-7 | Prove or kill the Likely items; protects the proof model | S |
| 2 | Fix S-1 and S-2 | Small, high value, no design decision | S |
| 3 | Fix D-1, D-2, S-5 deletion semantics and add credential deletion | Data loss and DPDP erasure | M |
| 4 | Quiz integrity: attempt cap, deadline, expiry, certificate archive (S-7, S-9, D-4) | Required before "Assessment verified" | M |
| 5 | Replace admin self-registration with invitations; add staff MFA (S-4) | The largest single privilege risk | M |
| 6 | Audit completeness: reason field, clean-data events, settings changes (S-6, D-5) | PRD-043 | M |
| 7 | Restrict proxy trust and add per-account throttles (S-3, S-11) | Closes the rate-limit bypass | S |
| 8 | Token and component layer; accessible dialog (Doc 03 UX-02, UX-06) | Unblocks every 2.0 screen | L |
| 9 | Consolidate deployment definitions; add uptime and error alerts | RISK-06, OPS-02 | S |
| 10 | Recover the "plan" documents or fold their decisions into the repo docs; fix the README | Onboarding and TASK-002 | S |

## 11. Not read or not verified

The notifications email templates and processors in detail; the resources and recordings services beyond their gating; the blogs, categories, logs and presence services; Supabase credential provider internals; all 43 page components beyond those cited; the admin analytics queries; whether S-1 reproduces (needs a request against a seeded database); throttler storage; production data; and anything about runtime behaviour.
