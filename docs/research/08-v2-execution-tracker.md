# 08. v2.0 Execution Tracker (Document 4 checklist)

Part of the [research pack](00-index.md). This is Document 4's task register with a status and evidence for every task, in Document 4's own milestone order (M0 to M9). It replaces the earlier re-sliced plan in Docs 06 and 07 as the driver: **work follows Document 4**. Status words are Document 4's: **Open**, **In progress**, **Blocked** (blocker named), **Done** (acceptance criteria met with evidence, tests passing). Nothing is Done yet: no task has had its listed tests and the second-person review.

Evidence is from the repository at the head of `feat/2.0-stabilise`. Paths and findings refer to [Doc 02](02-gap-analysis.md) and [Doc 04](04-existing-project-deep-analysis.md).

## Where we are

| Milestone | Tasks | In progress | Open | Blocked |
| --- | --- | --- | --- | --- |
| M0 Audit and baseline | 6 | 5 | 0 | 1 |
| M1 Foundation | 11 | 10 | 1 | 0 |
| M2 Design system and shell | 4 | 1 | 3 | 0 |
| M3 Identity, profile, community | 6 | 2 | 4 | 0 |
| M4 Learn and practice | 4 | 1 | 3 | 0 |
| M5 Prove and verify | 3 | 1 | 2 | 0 |
| M6 Careers | 8 | 0 | 8 | 0 |
| M7 Operations | 6 | 2 | 4 | 0 |
| M8 Release | 6 | 0 | 6 | 0 |
| M9 Improve | 2 | 0 | 2 | 0 |
| **Total** | **56** | **22** | **33** | **1** |

**Next in Document 4 order:** close M0 (TASK-001, 002, 006 need your approval or a second reviewer; TASK-003 and 005 are doable now; TASK-004 is blocked on hosting access), then start M1 with TASK-008 (permission engine), which almost everything else depends on.

## M0 Audit and baseline

| Task | Status | Evidence and what remains |
| --- | --- | --- |
| TASK-001 Audit repo, data, hosting; DEV-01 to DEV-10 | In progress | Audit and DEV answers in Docs 01, 02 (s6) and 04. Remaining: a stored route inventory (102 endpoints, 43 pages) and a second engineer's review |
| TASK-002 Gap analysis, doc update, threat model, data map | In progress | Every PRD and SCR classified in Doc 02. Threat model and data map drafted in [Doc 10](10-threat-model-and-data-map.md). Remaining: update Docs 1 to 4 (stack wording in DEC-021 and DEC-032, roles, the approval rule) and approval |
| TASK-003 Environments and secrets | In progress | Done: e2e suite refuses any non-local database (`apps/backend/test/require-local-db.cjs`, verified against the remote host); `docs/ops/environments.md` and README list the four environments and every variable; `.env.example` files updated. Remaining: create real preview and staging environments so "staging never reads production data" is true in practice |
| TASK-004 Backups and recovery drill | **Blocked** | Needs access to the Supabase and Render projects and a staging copy to restore into. None in the repo. Blocker: owner to provide access and name the plan |
| TASK-005 Logging, error tracking, uptime, alerts, incident process | In progress | Done: `docs/ops/incident-process.md` and `docs/ops/monitoring.md` (owners left as placeholders). Remaining: name the owners, set up an uptime check on `/api/health`, add error tracking and alert routing, then inject a test error (TEST-009) |
| TASK-006 Authentication review and decision (OPEN-13) | In progress | Decision record drafted: [Doc 09](09-auth-review-decision-record.md). Awaiting the owner's approval |

## M1 Foundation

| Task | Status | Evidence and what remains |
| --- | --- | --- |
| TASK-007 Migrations and background work | In progress | Done (TEST-009): `apps/backend/scripts/check-migrations.sh` rehearses every migration on a throwaway database from empty and over fixture data, detects schema drift, and runs in CI as a blocking step; every existing migration is reviewed for risk (`docs/ops/migration-review.md`); procedure written (`docs/ops/migrations.md`). Remaining: **nothing applies migrations on deploy** (see the deploy warning below), run the rehearsal against a copy of the real Supabase data, and decide on a Render pre-deploy command |
| TASK-008 Permission engine | In progress | Done: route inventory ([Doc 11](11-route-inventory.md)) and a data-driven permission matrix e2e test that discovers routes from Nest metadata (TEST-005, TEST-006). It found and fixed two real gaps: quiz authoring routes with no permission check, and unapproved blog posts readable publicly by id or slug. Remaining: resource and state rules (for example "own company only"), and the admin and identity areas' per-route rules as they grow |
| TASK-009 Sessions and step-up | In progress | Done (SEC-05, TEST-007): members signed out after 30 days idle; staff after 30 minutes idle and 8 hours absolute; enforced on refresh, no schema change, limits configurable by env. Remaining: step-up (reason plus fresh code), and the unenforced `sessionTimeoutMinutes` admin setting (remove it or make it real) |
| TASK-010 Validation and error format | In progress | Done (TEST-011): a global exception filter gives every error one body `{ statusCode, code, message, fields?, requestId? }` with stable codes; validation errors list each failing field; 5xx errors never expose stack, paths, SQL or internal messages; Prisma errors map to CONFLICT or NOT_FOUND without naming models; the maintenance flag still works; shared `ApiErrorBody` type and typed readers in the web client. Remaining: web forms should adopt the `fields` list for inline errors |
| TASK-011 Web security hardening | In progress | Done: security headers and a report-only CSP on the web app, CSRF assessment (`docs/ops/web-security.md`), secret scanning in CI (no leaks in 73 commits). Remaining: enforce the CSP, and dependency findings: `pnpm audit` reports 36 high and 7 critical (next, tar, proxy-addr, multer, nodemailer, body-parser and others) that need framework upgrades |
| TASK-012 Field-level protection | In progress | Done (TEST-034): a declarative field policy (one table entry per sensitive field, built so the later recruiter and date-of-birth rule is one more entry) and a test that calls every GET route as a member, moderator, instructor and anonymously and fails if another account's email, WhatsApp number, last login, token hashes, IPs or user agents appear. It found and fixed two leaks (public certificate verification and the public log endpoint). Remaining: apply it to the v2 fields as they are added (date of birth, CTC, notes) |
| TASK-013 Rate limits and bot protection | In progress | Done (TEST-013): Cloudflare Turnstile verification on register, login, forgot-password and verify-otp (off until a secret key is set; fails closed), widget in the web forms, and `TRUST_PROXY` is now configurable with the default unchanged. Remaining: the owner must set the Turnstile keys together and measure and set `TRUST_PROXY` for Render behind Vercel (`docs/ops/bot-protection.md`); allow Cloudflare in the CSP before enforcing it; rate limits on uploads and search |
| TASK-014 Private file pipeline | In progress | Done (TEST-012, backend): signed direct upload, type and size checks, signature scan, 60-second signed download links, an access log that records every open and every denied attempt, one `canOpen` policy (owner, admin, super_admin), non-owners get 404. Remaining: a real antivirus (the default scanner only checks file signatures), the web upload form, recruiter access after forwarding, retention deletion, and a private bucket created in Supabase |
| TASK-015 Append-only audit log | In progress | Done (TEST-008): `reason` column; database trigger blocks UPDATE and DELETE (still allows the foreign-key SET NULL when an actor is deleted); entries written for clean-data, settings changes and admin creation (the last still needs wiring); reason required for clean-data and user deletion, and the web delete dialog now sends it. Remaining: wire `logAdminRegistered` into the register-admin route; reasons for moderation and verification decisions as those features arrive; clean-data has no web screen yet |
| TASK-016 Background work, reliable hand-off | In progress | Done (TEST-009): explicit retries with backoff, idempotency keys so the same job is not sent twice, permanent failures do not retry, bounded retention, structured alert log lines for final failures and stalls, graceful shutdown. Remaining: an alert rule that matches the log line (TASK-005), scheduled jobs for expiry and retention (later tasks). Known risk: a stalled email job that is re-queued can send twice if the first worker had already handed it to the provider |
| TASK-017 Build, test, release pipeline | In progress | Done: secret-scan job (blocking), dependency-audit job (report-only), migration check step (blocking). Remaining: mark the jobs as required checks in GitHub branch protection (a repository setting), run the workflow once, make the audit blocking after the dependency fixes |

## M2 Design system and shell

| Task | Status | Evidence and what remains |
| --- | --- | --- |
| TASK-018 Tokens and component library | Open | Colours live in class names, not tokens; dark-only (Doc 03 s2) |
| TASK-019 App shell, navigation by role | Open | One member list plus Admin; no Mentor, Instructor or Recruiter navigation |
| TASK-020 States and accessibility baseline | Open | No `loading`, `error`, `not-found` boundaries; the dialog has no focus trap (Doc 03 s3) |
| TASK-021 Notification service | In progress | In-app bell, BullMQ email, realtime push. Missing: preferences, quiet hours, WhatsApp opt-in, delivery log |

## M3 Identity, profile and community

| Task | Status | Evidence and what remains |
| --- | --- | --- |
| TASK-022 Registration and email code | In progress | Email and password register; email **link** (24 h) sent only on admin approval, not a 6-digit code (PRD-001). Missing: PRD-004 (18+), PRD-006 (WhatsApp format) |
| TASK-023 Onboarding and required details | Open | Only name, email, optional WhatsApp and experience level are collected (PRD-003) |
| TASK-024 Resume upload and parsing | Open | No resume model |
| TASK-025 Profile, consent, privacy | Open | The terms tick is client-side only; no consent records |
| TASK-026 Community Q&A, guidelines, reputation | In progress | Threads, nested replies, reply likes, moderation. Missing: modes, accepted answer, report, guidelines, reputation |
| TASK-027 Skill taxonomy and suggestions | Open | Categories classify content, not skills |

## M4 Learn and practice

| Task | Status | Evidence and what remains |
| --- | --- | --- |
| TASK-028 Content catalog and publishing flow | In progress | Resources and recordings with approval flags; no Draft, In review, Published, Archived states |
| TASK-029 Enrollment and progress | Open | None |
| TASK-030 Labs and review | Open | No labs. Packet Lab (merged in PR 1) is hands-on practice but is **not** the PRD-020 lab (root cause, evidence, fix, reviewer scoring); a decision is needed on how it relates to M-08 |
| TASK-031 Mentoring requests | Open | No mentor role |

## M5 Prove and verify

| Task | Status | Evidence and what remains |
| --- | --- | --- |
| TASK-032 Assessment engine | In progress | Quizzes, attempts, scoring, certificates. Missing: attempt and retake limits, time limit enforcement, expiry, version, autosave (PRD-017, TEST-049) |
| TASK-033 Evidence submission and review | Open | Only self-entered `UserCertification` rows |
| TASK-034 Badge lifecycle, public verification page | Open | A public certificate verifier exists (precursor); no labels, expiry, revoke flow |

## M6 Careers

| Task | Status | Evidence and what remains |
| --- | --- | --- |
| TASK-035 to TASK-042 (company onboarding, positions, applications, screening and forwarding, payments, offers and invoices, recruiter dashboard, interviews) | Open | Nothing exists: no Company, Position, Application, Offer, Interview or Invoice model; no Recruiter role; no payment provider |

## M7 Operations

| Task | Status | Evidence and what remains |
| --- | --- | --- |
| TASK-043 Operations queues and moderation | In progress | Moderator actions on threads, activity log. Missing: reports queue, reasons, appeals by a different admin, service levels |
| TASK-044 Admin security | Open | No MFA, step-up, break-glass or access review; admin created by a shared secret (S-4) |
| TASK-045 Analytics events and funnel | Open | No analytics provider found; admin analytics page shows counts |
| TASK-046 Data rights and retention | In progress | Account deletion exists (and leaves the Supabase login, S-5). Missing: export, grace period, retention schedule |
| TASK-047 Feature switches and policy screens | Open | A `SiteSettings` row exists, but only `maintenanceMode` is enforced; see [Doc 10](10-threat-model-and-data-map.md) T-12 |
| TASK-048 Integrations (ClickUp, n8n) | Open | Not started; waits for OPEN-12 scope |

## M8 Release and M9 Improve

| Task | Status | Evidence and what remains |
| --- | --- | --- |
| TASK-049 Staged rollout of existing members | Open | Needs TASK-004 and TASK-017 first |
| TASK-050 Accessibility and device pass | Open | No screen-reader pass; no automated scan yet |
| TASK-051 Localization | Open | `lang="en"`, no i18n |
| TASK-052 Hide from companies | Open | Depends on M6 |
| TASK-053 Recruiter reminders and status messages | Open | Depends on M6 |
| TASK-054 Public trust pages | Open | Privacy page is a 24-line placeholder; Fees and How verification works do not exist |
| TASK-055 AI drafting behind review gates | Open | None |
| TASK-056 Post-launch monitoring | Open | Depends on TASK-005, TASK-045 |

## Work done beyond the register (needs your decision)

| Item | Why it matters |
| --- | --- |
| Packet Lab and the Tools section (PR 1, merged) | Not in Document 4 or the module map. It overlaps M-08 Practice and replaces the simulated Network Tools; it needs a DEC to sit in the module inventory (see Doc 01 s5) |
| Reset-token and reset-code fixes (this branch) | Closes findings S-2 and S-3; counts toward TASK-013 and TASK-009 |
| `test/security-regressions.e2e-spec.ts` | First of the TASK-008 and TASK-013 tests |

## Follow-ups raised by the parallel sessions (14 commits)

| Item | Why | Task |
| --- | --- | --- |
| ~~Web admin screens must send a `reason`~~ Done for user deletion; the web app has no clean-data screen | The backend returns 400 without a reason | TASK-015 |
| Wire `logAdminRegistered` into the shared-code admin signup | The audit helper exists but the identity route does not call it yet | TASK-015, TASK-044 |
| Remove or enforce the `sessionTimeoutMinutes` setting | Session limits now come from env variables; the admin field still does nothing | TASK-009, TASK-047 |
| Upgrade vulnerable dependencies (36 high, 7 critical) | Currently report-only in CI; blocking would fail every pull request | TASK-011 |
| Mark `secret-scan` and `dependency-audit` as required checks | A failed check only blocks release if branch protection requires it (GitHub setting) | TASK-017 |
| Per-account login lockout can lock a real member out for 15 minutes | Accepted trade-off of lockout; window and count are env-tunable (`LOGIN_MAX_FAILURES`, `LOGIN_LOCK_MINUTES`) | TASK-013 |
| `JWT_REFRESH_EXPIRES_IN` is no longer read | Refresh lifetime is now `SESSION_*` variables; old `.env` files still validate | TASK-009 |
| Next dev creates `apps/web/AGENTS.md` and `CLAUDE.md` | Untracked generated files; set `agentRules: false` in `next.config.mjs` if unwanted | none |
| Settings screen marks every unenforced setting "Saved, but not active yet" | Mitigates threat T-12 until each setting is enforced; remove the note per setting as it becomes real | TASK-047, TASK-009 |
| Real antivirus for uploads, private Supabase bucket, web upload form | The pipeline is built and tested but nothing in the UI uses it yet | TASK-014, TASK-024 |
| Alert rule for `alert:true` job logs | The jobs now emit alertable log lines; nothing is listening yet | TASK-005 |
| Test hygiene: run backend e2e suites one session at a time | Several sessions running the suite at once share one database and Redis and cause false failures | none |

## Migration status (20 Nov 2026)

`20261116100000_audit_log_append_only` and `20261116175303_private_files` were applied with `prisma migrate deploy` to the Supabase database that `apps/backend/.env` points at (the `aws-0-ap-northeast-1` pooler, 109 users). `prisma migrate status` reports the schema up to date. Read-only checks afterwards: the 16 existing audit rows are intact, the `reason` column and the append-only triggers exist, and the two file tables exist. **If production uses a different Supabase project, it still needs the same two migrations** (the deploy warning below applies to it).

## Deploy warning (read before deploying the backend)

**Nothing applies database migrations on deploy** (`apps/backend/Dockerfile` starts the app only; `render.yaml` has no pre-deploy command). The current backend code needs two migrations that are not on the live Supabase database yet: `20261116100000_audit_log_append_only` (the audit `reason` column, new action values and the append-only trigger) and `20261116175303_private_files` (the file tables). Deploying this backend without running `prisma migrate deploy` first will make admin actions that write the audit log fail. Procedure: back up Supabase, then run `prisma migrate deploy` from a trusted machine against the **direct** (not pooled) connection, as in `docs/ops/migrations.md`, then deploy.

## Follow-ups raised by batch 3

| Item | Why | Task |
| --- | --- | --- |
| Set the Turnstile site and secret keys together | Setting only the secret key would lock everyone out of sign-in | TASK-013 |
| Measure and set `TRUST_PROXY` | The default is unchanged (trust everything); a wrong hop count either shares one IP limit between all visitors or re-opens spoofing | TASK-013 |
| Allow `https://challenges.cloudflare.com` in the CSP before enforcing it | The report-only CSP will otherwise block the widget | TASK-011 |
| Add `prisma migrate deploy` as a Render pre-deploy command | Needs a staging environment first | TASK-003, TASK-007 |
