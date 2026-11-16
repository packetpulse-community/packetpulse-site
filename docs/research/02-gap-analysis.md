# 02. Gap Analysis

Part of the [research pack](00-index.md). First pass of TASK-001 (audit) and TASK-002 (classify every PRD and SCR) from Doc 4, against HEAD `dc44af1`. File paths are relative to the repo root.

Classification: **Present** (meets the requirement), **Partial** (some of it exists), **Different** (something exists that solves the same need another way), **Missing**. Nothing is classified Present because nothing was run; "Present" would need a passing test (Doc 4 s10).

## 1. Scorecard

| Set | Total | Present | Partial | Different | Missing |
| --- | --- | --- | --- | --- | --- |
| PRD requirements | 54 | 0 | 16 | 3 | 35 |
| Screens SCR-001 to SCR-046 | 46 | 0 | 15 | 3 | 27 (+1 Deferred) |
| Workflows WF-001 to WF-013 | 13 | 0 | 5 | 1 | 7 |
| Roles in DEC-009 | 6 | 4 | 0 | 0 | 2 |

Reading the table: the 16 Partial PRDs are almost all the community, assessment, notification, audit and security foundations. The 35 Missing are everything that makes 2.0 a careers platform. Careers (PRD-029 to PRD-040, PRD-050 to PRD-053) is entirely missing: 16 requirements, 10 screens, 4 workflows, about 10 tasks.

## 2. Requirement classification

### 2.1 Identity, onboarding and profiles (PRD-001 to PRD-010)

| ID | Class | Evidence and gap |
| --- | --- | --- |
| PRD-001 | Different | Email and password only, no passkey. Verification is a 24 h single-use link (`EmailVerification`), not a 6-digit code with attempt and resend limits. The 6-digit 10-minute OTP exists only for password reset (`PasswordReset`, `VerifyOtpSchema`). First verification email is sent on admin approval, not at registration (`email-verification.service.ts`) |
| PRD-002 | Different | `professionalExperience` is an optional 5-value enum (student, junior, mid, senior, lead), not a Fresher/Experienced choice that drives required fields (`RegisterSchema`) |
| PRD-003 | Partial | Collected at signup: name, email, WhatsApp (optional), experience (optional). Missing: date of birth, years of experience, domain, role, skills, LinkedIn as required, current company, CTC, notice period. No apply-blocking exists because there is no apply |
| PRD-004 | Missing | No date of birth field on `User` |
| PRD-005 | Partial | `UserSocialLinks.linkedin` exists. Format rule not verified (only `RegisterSchema` was read) |
| PRD-006 | Missing | `whatsappNumber` is a free string; the form placeholder is `+918793700336` but nothing enforces 10-digit Indian mobiles |
| PRD-007 | Missing | No resume model, upload or parser |
| PRD-008 | Missing | No completeness or readiness score |
| PRD-009 | Missing | No compensation fields |
| PRD-010 | Missing | The terms checkbox is client-only (`RegisterFormSchema.termsAccepted`) and is stripped before the API call; no consent table or timestamps |

### 2.2 Skills, verification and assessments (PRD-011 to PRD-018)

| ID | Class | Evidence and gap |
| --- | --- | --- |
| PRD-011 | Missing | No skill taxonomy. `Category` (7 seeded: General, CCNA, CCNP, Network Automation, Security, SDN, IPv6) classifies content, not skills, and has no Major/Minor/Micro tree, suggestions or merge |
| PRD-012 | Missing | No labels or evidence records |
| PRD-013 | Partial | `UserCertification` stores name, issue date, expiry and a URL, self-entered. No issuer, credential ID, file, accuracy confirmation or reviewer |
| PRD-014 | Missing | No reviewer decision flow |
| PRD-015 | Missing | Closest precedent: `Certificate.revokedAt` for quiz certificates. No appeal or expiry logic |
| PRD-016 | Missing | No badge lifecycle |
| PRD-017 | Partial | `Quiz` has `passingScorePct` (default 70), `timeLimitSeconds`, `isPublished`, category. Missing: level, version, attempt cap, retake gap, expiry, visibility |
| PRD-018 | Partial | `QuizAttempt` records score, pass, status (in_progress, submitted, expired), start and submit times. A pass issues a `Certificate` directly with no evidence record or version. No weak-topic breakdown verified |

### 2.3 Learning, practice and content (PRD-019 to PRD-023)

| ID | Class | Evidence and gap |
| --- | --- | --- |
| PRD-019 | Missing | No enrollment or progress. `RecordingParticipant` records who joined a recording only |
| PRD-020 | Missing | No labs. `/network-tools` is a **simulated** diagnostic runner seeded by target name (`network-tools.service.ts`), not a troubleshooting lab |
| PRD-021 | Partial | Resources and Recordings carry owner, category, tags, premium, approval, created/updated. Missing: source, usage rights, review date, difficulty, skill link, attribution |
| PRD-022 | Partial | `isApproved` (boolean) and `isPublished` replace the Draft / In review / Published / Archived states. Blog posts and resources default to approved, so moderation is opt-in rather than a gate (`schema.prisma` comments). No reason on change requests |
| PRD-023 | Partial | `premium` boolean on Resource and Recording. No price, GST, checkout, or experienced-only rule |

### 2.4 Community (PRD-024 to PRD-028, PRD-054)

| ID | Class | Evidence and gap |
| --- | --- | --- |
| PRD-024 | Partial | `ForumThread` has category, title, content. No Learning/Production/Expert mode, no length minimums (client only checks non-empty), no sensitive-data confirmation (`NewThreadForm.tsx`) |
| PRD-025 | Partial | Nested replies and reply likes exist. No accepted answer, follow, or report |
| PRD-026 | Missing | No reputation |
| PRD-027 | Missing | No mentor role or request flow |
| PRD-028 | Partial | `forums:moderate` can pin, lock, delete threads; actions write `AdminActivityLog`. No report queue, no reason on removal, no written policy, no appeals |
| PRD-054 | Missing | No guidelines page or acceptance record |

### 2.5 Jobs, recruitment, fees (PRD-029 to PRD-040, PRD-050 to PRD-053)

All **Missing**. No Company, Position, Application, Offer, Interview, Invoice, Payment or Recruiter role exists anywhere in schema, routes or seed. No payment provider package was found in either app.

### 2.6 Notifications, privacy, security, AI, language, accessibility (PRD-041 to PRD-049)

| ID | Class | Evidence and gap |
| --- | --- | --- |
| PRD-041 | Partial | `Notification` model (6 types), `NotificationBell` in-app, BullMQ email queue (`email.processor.ts`, `fanout.processor.ts`), realtime push. Missing: preferences, quiet hours, WhatsApp, delivery log, critical-event rules, a notifications page |
| PRD-042 | Missing | No MFA, passkeys, step-up or lockout beyond throttling. Admin accounts can be created with one shared `ADMIN_SECURE_CODE`. Session: 15 min access, 7 day refresh with rotation and family revocation (`schema.prisma` RefreshToken) |
| PRD-043 | Partial | `AdminActivityLog` has actor, action, target, JSON details, time; 18 actions across users, content, forums, quizzes; actor set null on delete so the trail survives. No required reason field, no append-only enforcement seen at database level, no coverage of settings changes |
| PRD-044 | Partial | Roles and permissions are data-driven and `users:manage-roles` gates changes. No policy versioning, no AI or visibility policy |
| PRD-045 | Partial | Account deletion with password re-entry (`users.controller.ts`, `DeleteAccountDialog`). No export, no grace period, no consent history, no grievance contact. The privacy page is a 24-line placeholder that says a formal policy "is in progress" |
| PRD-046 | Different | Storage uses Supabase `getPublicUrl` (`supabase-storage.provider.ts`): public links, not short-lived signed ones, and no open logging. No resume or certificate file feature uses it yet, so the risk is latent |
| PRD-047 | Missing | No AI features, so nothing to constrain yet |
| PRD-048 | Missing | `<html lang="en">`, no i18n library, no Hindi strings |
| PRD-049 | Partial | See [Doc 03](03-ux-research-analysis.md) section 4: scattered ARIA, one `focus-visible`, no skip link, no reduced-motion handling, dark theme only |

## 3. Screen classification

| ID | Doc 3 screen | Class | What exists |
| --- | --- | --- | --- |
| SCR-001 | Home | Partial | `/` with hero, stats strip, offer, resources, events, FAQ. Does not explain the loop or link to fees |
| SCR-002 | Fees | Missing | |
| SCR-003 | Join and verify | Different | `/register` (long form incl. confirm password), `/verify-email` (link target) |
| SCR-004 | Dashboard | Different | Six stat tiles of site totals, a simulated "Network Snapshot", four tool shortcuts. No loop tracker, next step, completeness or checklist; welcome line says "pending admin approval" |
| SCR-005 | Learn | Partial | `/resources`, `/recordings` list and detail; no states, enroll or progress |
| SCR-006 | Practice | Missing | |
| SCR-007 | Assessments and verified skills | Partial | `/quizzes`, `QuizAttempt`, `/certificates`; no skills list or labels |
| SCR-008 to SCR-009 | Jobs, Applications | Missing | |
| SCR-010, SCR-011 | Community, Thread | Partial | `/forums`, `/forums/[id]` |
| SCR-012 | Profile | Partial | `/profile` edit, password change, delete account |
| SCR-013 | Notifications | Partial | Bell dropdown only; no `/notifications` page or mark-all-read page |
| SCR-014 to SCR-016 | Reviews, Review detail, Mentoring | Missing | |
| SCR-017 | Content | Partial | Admin forms for blogs, resources, recordings, quizzes; no Draft/In review flow |
| SCR-018 to SCR-023 | Recruiter screens | Missing | |
| SCR-024 | Operations | Partial | `/admin` with stats, pending banners, recent activity, quick access |
| SCR-025 | Verification | Missing | |
| SCR-026 | Taxonomy | Different | `/admin/categories` manages content categories |
| SCR-027 | Payments | Missing | |
| SCR-028 | Analytics | Partial | `/admin/analytics` (growth, distribution charts) |
| SCR-029 | Users | Partial | `/admin/users`, role dialog, delete dialog, approvals |
| SCR-030, SCR-031 | Roles, Policies | Missing | Roles are assigned per user in a dialog; no matrix or policy screen |
| SCR-032 | Security | Partial | `/admin/settings` (maintenance, registration toggle, session timeout, rate limit, upload size) |
| SCR-033, SCR-035 to SCR-041, SCR-044, SCR-046 | Company onboarding, lesson player, lab workspace, notification prefs, data rights, billing, calendar, integrations, hide-from-companies, guidelines | Missing | |
| SCR-034 | Assessment attempt | Partial | `QuizAttempt.tsx` and `AttemptHistory.tsx`; autosave, resume with remaining time, attempt limits not verified |
| SCR-042 | Public profile | Deferred | Per PRD-052 |
| SCR-043 | Error pages | Partial | `/maintenance` only. No `not-found.tsx`, `error.tsx`, `loading.tsx` or `global-error.tsx` anywhere under `apps/web/src/app` |
| SCR-045 | How verification works | Partial | `/certificates/verify/[number]` is a public verifier for one certificate, not a criteria page |

**Shipped screens with no 2.0 SCR ID** (must be assigned or retired): `/blogs`, `/blogs/[slug]`, `/network-tools`, `/about`, `/contact`, `/privacy`, `/terms`, `/forgot-password`, `/refresh`, `/certificates`, quiz create and edit, and admin pages for blogs, logs, status, api-docs.

## 4. Workflow classification

| ID | Class | Note |
| --- | --- | --- |
| WF-001 Discovery to first value | Different | Register, wait for admin approval, receive verification email, verify, sign in. No resume review, consent step or first-action prompt |
| WF-002 Evidence verification | Missing | |
| WF-003 Assessment to verification | Partial | Quiz to certificate exists; no evidence record or reviewer |
| WF-004 Lab practice | Missing | |
| WF-005 Community question and moderation | Partial | Ask, reply, like, moderate; no report or accepted answer |
| WF-006, WF-007, WF-012, WF-013 | Missing | Careers |
| WF-008 Admin action with audit | Partial | Audit exists; no MFA, step-up or reason capture |
| WF-009 Content publishing | Partial | Admin approval toggles; no Draft/In review states |
| WF-010 Paid service and refund | Missing | |
| WF-011 Data rights and consent | Partial | Delete only |

## 5. Role classification (DEC-009)

| Doc role | Repo | Class |
| --- | --- | --- |
| Member | `member` | Present (permissions differ from PRD matrix) |
| Mentor | none | Missing |
| Instructor | `instructor` (recordings:create, quizzes:author) | Present |
| Recruiter | none | Missing; also needs company-scoped roles (DB-002) |
| Admin | `admin` | Present |
| SuperAdmin | `super_admin` (guard bypass) | Present; the matrix says "SuperAdmin column fixed" (API-041), which the bypass satisfies |
| not in docs | `moderator` | Extra; see DEC-038 |

## 6. Developer confirmation list (DEV-01 to DEV-10) answered

| ID | Answer from the repo | Remaining check |
| --- | --- | --- |
| DEV-01 | Next.js 16.3.0, React 19.2, NestJS 10, Prisma, Node 24 (`.nvmrc`, engines). App Router. README says Next 15 | Confirm 16.3 is a supported release and that patches are current |
| DEV-02 | Web on Vercel (`vercel.json`, region sin1). Backend on Render, Docker, free plan, Singapore (`render.yaml`). Background jobs run in the same backend process via BullMQ processors; no separate worker service or scheduled-job config found | Confirm free-plan sleep behaviour against the 5 s DB ping and health check history |
| DEV-03 | Browser talks to the backend only. `@supabase/supabase-js` is in the web dependencies but `src` references it only in `useRealtime.ts`. Row-level security is therefore not the main protection | Confirm Realtime channel exposure |
| DEV-04 | Backend. Global guard chain in `app.module.ts`: JWT, maintenance, permission/role, approval. Web layouts also redirect (e.g. `(admin)/layout.tsx`) | Check every controller for a missing `@RequirePermission` or `@Public` decision; 102 endpoints |
| DEV-05 | Own JWT in httpOnly, `sameSite=lax` cookies; access 15 min, refresh 7 days hashed and rotated; `proxy.ts` renews expired sessions through `/refresh`. Credentials in Postgres (docker) or Supabase Auth (supabase mode) | Decision for TASK-006 on MFA and password policy |
| DEV-06 | Redis backs BullMQ queues (email, fan-out). Throttler storage not verified | Confirm throttler and presence storage |
| DEV-07 | Supabase Storage with public URLs; max upload size is a site setting (default 10 MB, Doc says 5 MB) | Bucket policies; scanning; signed links |
| DEV-08 | Connected: Resend, SMTP, Supabase. Not found: payments, analytics, ClickUp, n8n, error tracking | Check hosting env var names |
| DEV-09 | CI is solid (lint, typecheck, build, migrate, seed, e2e, image smoke test). Tests: 9 e2e cases, 0 unit tests, `vitest --passWithNoTests` on web. Observability: pino logging, tracing file, ClientLog, health endpoint | Add tests before touching permissions or money (Doc 4 s10) |
| DEV-10 | Not determinable from the repo. `render.yaml` is free plan; Supabase plan unknown | Run a restore drill (TASK-004) |

## 7. Doc 4 tasks the repo already partly covers

| Task | State | Evidence |
| --- | --- | --- |
| TASK-003 environments and secrets | Partial | `.env.example` files, `generateValue` secrets in `render.yaml`, env schema validated at boot. A root `.env` is tracked locally (`.env`, 119 bytes) and should be checked for secrets |
| TASK-007 migrations and background work | Present in form | 10 reviewable Prisma migrations; BullMQ in the backend |
| TASK-008 permission engine | Partial | Permission keys and guards exist; no resource and state rules (e.g. "own company only") |
| TASK-010 validation and error format | Partial | Zod pipe on every route; error shape consistency not verified |
| TASK-011 hardening | Partial | `helmet`, `cookie-parser`, strict CORS allowlist, httpOnly cookies. CSRF posture with `sameSite=lax` not assessed |
| TASK-013 rate limits | Partial | Global 300/min plus 85 `@Throttle` annotations, strict tier on auth routes. No bot protection |
| TASK-015 audit log | Partial | See PRD-043 |
| TASK-016 background work | Partial | BullMQ with processors; idempotence and stall alerts not verified |
| TASK-017 pipeline | Present in form | `.github/workflows/ci.yml` |
| TASK-021 notification service | Partial | See PRD-041 |
| TASK-027 taxonomy | Not started | Needs a new model; `Category` is not reusable as is |
| TASK-014 private files | Not started | Public URLs today |

## 8. Risks this audit raises or sharpens

| Ref | Risk | Evidence | Suggested response |
| --- | --- | --- | --- |
| RISK-04 | Permissions are mostly enforced on the server, which is good, but coverage is unproven | Guard chain exists; no unit tests; 9 e2e cases | Generate a route-by-role matrix test before adding any new module (TEST-005, TEST-006) |
| RISK-02 | DPDP gaps are large | No consent records, no export, placeholder privacy policy, WhatsApp number and experience collected without stated purpose | Pull TASK-025, TASK-046 forward; write the notice before more data collection |
| RISK-06 | Free-plan hosting for the backend | `render.yaml` plan free; commit `2e836ed` raised the DB ping timeout | Plan upgrade before Release 1 traffic; cold starts affect first-impression UX |
| RISK-05 | Existing members hit new gates | `isApproved` and `emailVerified` already gate access; adding required fields will block current users | Grandfather existing members into "profile incomplete" with a banner, not a block |
| New | Trust: simulated data presented beside real data | Dashboard "Network Snapshot" and Network Tools are generated | Remove or label clearly (already labelled "Simulated" on the dashboard; not on the tools page, not verified) |
| New | Two sources of truth for the stack and README drift | README says Next 15, package says 16.3 | Update README in TASK-002 |

## 9. Not verified

Production data (member counts, role counts), any running behaviour, mobile layouts, the `main` branch versus this branch, throttler storage, bucket policies, whether every one of the 102 endpoints carries the intended permission decorator, the Mongo-to-Postgres migration script's state, and the `.docx` copy of Doc 3.
