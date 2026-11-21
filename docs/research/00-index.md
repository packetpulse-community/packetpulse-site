# PacketPulse 2.0: Context, Research and Analysis Pack

Prepared 22 Oct 2026 from the v2 document set (17 Oct 2026) and a read-only audit of this repository (branch `feat/platform-mode-supabase`, HEAD `dc44af1`).

| # | Document | What it answers |
| --- | --- | --- |
| 01 | [Context](01-context.md) | What PacketPulse 2.0 is meant to be, what actually exists today, and where the two diverge at the level of stack, roles and product shape |
| 02 | [Gap analysis](02-gap-analysis.md) | Every PRD, SCR, role and DEV question classified Present / Partial / Different / Missing with file evidence (this is TASK-001 and TASK-002 from Document 4, first pass) |
| 03 | [UI/UX research and analysis](03-ux-research-analysis.md) | Design-system drift, a heuristic audit against DES-001 to DES-012, journey friction, accessibility signals, a user-research plan, and a ranked UX backlog |
| 04 | [Existing project deep analysis](04-existing-project-deep-analysis.md) | Code-level review: architecture, every backend module, data model, 15 security and integrity findings, tests, operations, ranked tech-debt register |
| 05 | [Packet Lab analysis and spec](05-packet-lab-analysis-and-spec.md) | Design goals, OSI and TCP/IP live visualisation, byte-accurate packet tracing, a small live network simulation, engine design, verification plan, phased build |
| 06 | [Completing 2.0: pending work analysis](06-completing-2.0-pending-work-analysis.md) | Task register re-baselined against the repo, effort and calendar by team size, decision gates, three ways to finish, a recommended phased plan, quick wins, member-migration strategy |
| 07 | [Solo plan and community discussion brief](07-solo-plan-and-community-discussion.md) | A plan sized for one developer with dates, plus a kit for discussing priorities with community members: poll, announcement text, open-call agenda, volunteer roles, FAQ |
| 08 | [v2.0 execution tracker](08-v2-execution-tracker.md) | Document 4's 56-task checklist with a status and evidence for each, in Document 4's own milestone order; this is now the driver |
| 09 | [Authentication review and decision record](09-auth-review-decision-record.md) | TASK-006 / DEV-05: today's sign-in and sessions against the OPEN-13 and DEC-020 baseline, a proposed decision and a closing plan |
| 10 | [Threat model and data map](10-threat-model-and-data-map.md) | SEC-13 / TASK-002: 15 threats with controls and gaps, a data map, processors and locations |
| 11 | [Route inventory](11-route-inventory.md) | Every backend route with its access rule, generated from the live router metadata (TASK-008) |
| 12 | [Session and latency analysis](12-session-and-latency-analysis.md) | Why the public navbar showed Sign In and why the session loads late: measured causes, the fixes made, and ranked options still open |
| 13 | [UI migration checklist](13-ui-migration-checklist.md) | Which screens are on the Grove theme and which are still legacy |
| 14 | [Policy review pack](14-policy-review-pack.md) | Every policy text and default the build chose, in plain language, with options, a recommended answer, tick boxes, what needs a lawyer, and an answer sheet for the core admins. Not legal advice |

## How much to trust this pack

| Evidence level | Meaning | Where it appears |
| --- | --- | --- |
| **Verified** | Read directly in the code, schema or config in this repo | Marked with a file path |
| **Inferred** | A reasonable reading of verified code, not run | Marked "inferred" |
| **Not verified** | Needs a running app, production access or real users | Listed in each document's "Not verified" section |

Two limits matter. First, nothing was run: the UX audit is a static review of source, not a browser session, so contrast, layout and motion findings are predictions to confirm. Second, no real users were involved: personas and journey friction points are hypotheses, as Document 1 section 4 already says of itself. Section 5 of Document 03 is the plan to replace those hypotheses with evidence.

## The five findings that change the plan

1. **The stack in the docs is not the stack in the repo.** Documents 1 and 4 say "Next.js for frontend and backend". The repo is a Next.js 16.3 web app plus a separate NestJS 10 modular monolith, PostgreSQL through Prisma, Redis with BullMQ, and a `PLATFORM_MODE` switch between local Docker and Supabase. DEC-021 to DEC-023 should be restated before anyone builds on them.
2. **PacketPulse 1.x is a content community, not the start of a careers platform.** Of 54 requirements, 16 are Partial, 3 Different, 35 Missing and none is fully Present. The partial ones are forums, quizzes with certificates, notifications, audit log, RBAC and rate limits. Everything that makes 2.0 distinct (skill taxonomy, evidence verification, jobs, recruiters, payments, consent, labs) does not exist yet. See Document 02 section 1 for counts.
3. **Admin approval of every new member is live and undocumented.** The repo gates all access behind `isApproved`, and the first verification email is only sent when an admin approves. Documents 1 and 3 describe instant onboarding (WF-001). This is the single biggest hidden product decision and needs an owner ruling (DEC-035 proposed in Document 01).
4. **Existing features have no home in the 2.0 module map.** Blogs, Resources library, Recordings, Network Tools and quiz Certificates are shipped and used, but none appear in Document 1's module inventory. Either they fold into Learn/Practice/Assessments or they are formally kept. See Document 01 section 5.
5. **The visual identity is the opposite of Signal Grove.** Production is dark-only, indigo/purple/cyan glassmorphism with hard-coded colour classes in 110 places and no theme switch. DEC-003 asks for light-first forest green. That is a re-skin of every screen, not a token tweak, and it is the largest UI cost in the plan.
