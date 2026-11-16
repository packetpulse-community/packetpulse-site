# 01. Context

Part of the [research pack](00-index.md). Sources: the four v2 documents (cited as Doc 1 to Doc 4) and the repository at HEAD `dc44af1`.

## 1. The product the v2 documents describe

**One loop:** Learn, Practice, Prove, Verify, Connect, Get hired, Grow (DEC-001). Every feature must serve it.

| Item | Summary | Source |
| --- | --- | --- |
| Mission | Help network, security and cloud engineers learn, prove what they can do, and be trusted for it | Doc 1 s2.1 |
| Differentiator | Skills carry evidence; practice is troubleshooting; recruitment runs through human review | Doc 1 s2.2 |
| Users | Fresher, experienced engineer, mentor, instructor, recruiter, admin, SuperAdmin. About 2,000 members, 8 admins, 1 SuperAdmin (owner-reported) | Doc 1 s2.3 |
| Modules | 15 (M-01 to M-15) across 4 releases: Foundation, Prove, Careers, Intelligence | Doc 1 s5, s8 |
| Requirements | 54 PRDs, 33 DECs, 21 OPENs, 12 RISKs | Doc 1 s6, s9, s10, s11 |
| Visual direction | Signal Grove: light-first, forest green primary, four module accents, Inter and JetBrains Mono, WCAG 2.2 AA | Doc 2 |
| Delivery | 10 milestones (M0 to M9), 56 tasks, 50 tests; M0 is a repository audit | Doc 4 s7 to s9 |

Constraints the owner has fixed: no technology is replaced without a concrete requirement (DEC-023); people decide, AI drafts (DEC-019); the placement fee stands but needs safeguards and legal review (DEC-016, OPEN-07); main DPDP duties apply from about 14 May 2027 (DEC-026).

## 2. The product that exists today (verified)

PacketPulse 1.x is a **community platform for networking professionals**: content, discussion, quizzes and admin tooling. 406 tracked files, about 18k lines of TypeScript, 173 React components, 102 HTTP endpoints, 10 Prisma migrations (Aug to Sep 2026).

### 2.1 Architecture and hosting

| Layer | What the repo shows | File |
| --- | --- | --- |
| Monorepo | pnpm workspaces and Turborepo: `apps/web`, `apps/backend`, `packages/types` (shared Zod), `packages/eslint-config`, `packages/tsconfig` | `package.json`, `pnpm-workspace.yaml` |
| Frontend | Next.js **16.3.0** (README still says 15), React 19.2, App Router, Tailwind 3.4, React Query, React Hook Form with Zod, Radix (accordion, tooltip), cmdk, framer-motion, sonner, socket.io-client | `apps/web/package.json` |
| Backend | **NestJS 10** modular monolith, 14 feature modules, Prisma, Zod validation pipe, global guard chain (Throttler, JWT, Maintenance, Roles, Approved) | `apps/backend/src/app.module.ts` |
| Data | PostgreSQL via Prisma (Supabase-compatible), Redis with BullMQ for email and fan-out jobs | `schema.prisma`, `notifications/infrastructure/queue` |
| Platform modes | `PLATFORM_MODE=docker` (local Postgres, custom JWT, Socket.IO) or `supabase` (Supabase Auth, Realtime, Storage). Custom JWT signs sessions in both modes | `common/config/env.schema.ts` |
| Hosting | Backend on Render (Docker, **free plan**, Singapore) with `/api/health`; web on Vercel (`sin1`); test domain `test.packetpulse.in` | `render.yaml`, `apps/web/vercel.json` |
| Email | Resend HTTPS API when `RESEND_API_KEY` is set, else SMTP (Render free tier blocks SMTP) | recent commits `baf57e4`, `dc44af1` |
| CI | GitHub Actions: lint, typecheck, build, migrate, seed, unit, e2e against real Postgres/Redis, Docker image build and smoke test | `.github/workflows/ci.yml` |
| Tests | 9 e2e cases (7 auth, 2 maintenance), **0 unit tests** on either app | `apps/backend/test` |

### 2.2 Domain model (verified, 36 Prisma models)

| Area | Models |
| --- | --- |
| Identity | User, UserSocialLinks (LinkedIn, GitHub, Twitter, website), UserCertification (self-entered, optional URL), RefreshToken (hashed, rotated, family revocation), PasswordReset (6-digit OTP, 10 min), EmailVerification (24 h link token), Role, Permission, RolePermission, UserRole |
| Content | Category (shared, admin-editable, 7 seeded), BlogPost, BlogPostTag, BlogPostImage, BlogComment, BlogLike, Resource, ResourceTag, ResourceLike, Recording, RecordingTag, RecordingParticipant, RecordingLike |
| Community | ForumThread, ForumReply (nested), ForumReplyLike |
| Assessment | Quiz, QuizQuestion, QuizQuestionOption, QuizAttempt, QuizAttemptAnswer, Certificate (public number, `revokedAt`) |
| Platform | Notification (6 types, JSON payload), AdminActivityLog (18 actions), SiteSettings (singleton), ClientLog |

### 2.3 Roles and permissions (verified)

Five roles seeded: `member`, `moderator`, `instructor`, `admin`, `super_admin` (bypasses all checks). Seventeen permission keys such as `forums:moderate`, `users:approve`, `quizzes:author`. Roles are additive per user (`UserRole`). A separate **`isApproved` flag** gates all access regardless of role, and `emailVerified` is also required. An admin account can be registered with a shared `ADMIN_SECURE_CODE`.

### 2.4 Routes (verified, 43 pages)

| Group | Routes |
| --- | --- |
| Public | `/`, `/about`, `/contact`, `/privacy`, `/terms`, `/blogs`, `/blogs/[slug]`, `/certificates/verify/[number]`, `/maintenance` |
| Auth | `/login`, `/register`, `/verify-email`, `/forgot-password`, `/refresh` |
| Member | `/dashboard`, `/resources(+id)`, `/recordings(+id)`, `/network-tools`, `/forums(+id)`, `/quizzes(+id, new, edit)`, `/certificates`, `/profile` |
| Admin | `/admin` plus users, blogs, resources, recordings, forums, quizzes (new, edit), categories, analytics, logs, settings, status, api-docs |

## 3. How the two line up at the top level

| Dimension | v2 documents say | Repo is | Consequence |
| --- | --- | --- | --- |
| Product shape | Careers platform with a community | Content community with admin tooling | Release 1 "Foundation" is mostly Release 0 plus gaps, not a greenfield |
| Backend | "Next.js for frontend and backend" (DEC-021, DEC-032) | Separate NestJS service | Doc 4 s2 architecture rules map cleanly onto NestJS guards, modules and BullMQ; restate the decision |
| Next.js version | DEV-01 asks which | 16.3.0 (README says 15) | Answers DEV-01; fix README |
| Roles | Member, Mentor, Instructor, Recruiter, Admin, SuperAdmin | member, moderator, instructor, admin, super_admin | Add Mentor and Recruiter; decide whether Moderator is kept (docs give moderation to Admin) |
| Onboarding | Instant access after email code (WF-001) | Admin approval required; verification email sent only on approval | Needs DEC-035 (below) |
| Email verification | 6-digit code, 10 min, 5 attempts (PRD-001) | 24 h single-use link; 6-digit OTP only for password reset | Different mechanism, same intent |
| Passwords | 12+ chars, breach check, no complexity rules (OPEN-13) | 8+ chars with 4 complexity rules | Contradicts current NIST-style guidance the docs recommend |
| Visual identity | Signal Grove, light-first, forest green | Dark-only, indigo/purple/cyan glass | Full re-skin (see Doc 03) |
| Language | English with Hindi switch | `lang="en"`, no i18n | PRD-048 is net-new |
| Observability | Alerts to a named owner (OPS-02) | pino logging, OpenTelemetry tracing file, ClientLog table, health endpoint; no error tracker or alert routing found | Partial |

## 4. Stakeholders and decision owners

The documents name roles but no people ("to be named" on every owner line). Until named, these decisions block work (Doc 4 s12): OPEN-01 (primary colour), OPEN-03 and OPEN-05 (verification and assessment rules), OPEN-07 (fee legal review), OPEN-08 and OPEN-09 (payments, prices), OPEN-10 (company onboarding), OPEN-04 and OPEN-18 (notifications, sender identity), and team size.

New decisions this audit adds (proposed, for the owner):

| ID | Proposal | Reason |
| --- | --- | --- |
| DEC-035 | Rule on member approval: keep manual approval for launch, move to automatic approval with a "review later" admin queue, or drop it | Live behaviour contradicts WF-001 and the 60% profile-ready target in Doc 1 s3.1; every approval is a human wait on the member's first visit |
| DEC-036 | Restate DEC-021 and DEC-032 as "Next.js web app, NestJS backend, PostgreSQL via Prisma, Redis with BullMQ, Vercel and Render" | Docs misstate the stack |
| DEC-037 | Decide the fate of Blogs, Resources, Recordings and Network Tools in the module map (section 5) | They exist, have users, and sit outside every release |
| DEC-038 | Keep or drop the `moderator` role | Present in code, absent from DEC-009 |
| DEC-039 | Decide whether Network Tools stays simulated, becomes real, or is removed | Output is seeded random data (labelled "Simulated" on the dashboard only) |

## 5. Existing features that need a home in the module map

| Existing feature | Evidence | Nearest 2.0 module | Recommendation (for owner review) |
| --- | --- | --- | --- |
| Blogs with comments, likes, tags, moderation | `blogs` module, `/blogs` | M-05 Community | Keep as community content; it is the main public SEO surface for the "technical content attracts engineers" acquisition hypothesis (Doc 1 s4) |
| Resources library (pdf, video, config templates, tools, links; premium flag) | `resources` module | M-07 Learn | Keep as a library; `premium` becomes the Free/Paid flag (DEC-017) once payments exist |
| Recordings (session videos with instructor, participants) | `recordings` module | M-07 Learn (live sessions) | Keep; maps to "live sessions" in PRD-023 |
| Quizzes and certificates with public verify page | `quizzes` module, `/certificates/verify/[number]` | M-09 Assessments, M-10 Verification | Strongest existing asset. Certificate verification is the seed of "How verification works" (SCR-045) and of Assessment verified |
| Network Tools (simulated ping, traceroute, DNS, port scan) | `network-tools.service.ts` header comment | M-08 Practice (loosely) | Do not market as real diagnostics. Either rebuild as scenario tools for Practice or retire (DEC-039) |
| Dashboard "Network Snapshot" | `dashboard/page.tsx` | none | Simulated uptime, networks, devices and alerts. Conflicts with "evidence over claims" (principle 2); replace with the loop tracker (SCR-004) |

## 6. Assumptions carried into the analysis

1. The documents' 2,000 members and 9 staff are owner-reported and not checked against the production database.
2. The `feat/platform-mode-supabase` branch is the closest thing to production; `main` was not diffed against it.
3. `test.packetpulse.in` is a test deployment; the production domain and its state were not inspected.
4. Everything marked PV in the documents refers to a single-file prototype that was not provided. This pack uses the written specs, not the prototype.
5. The `.docx` copy of Document 3 was not opened; the `.md` copy was used.
