# 06. Completing PacketPulse 2.0: Pending Work Analysis

Part of the [research pack](00-index.md). Question answered: **what is still pending for 2.0, what can we realistically do about it, in what order, and what has to be decided first.** It re-baselines Doc 4's 56 tasks against the real repo ([Doc 02](02-gap-analysis.md), [Doc 04](04-existing-project-deep-analysis.md)), sizes what is left, compares ways to finish it, and recommends a sequence. The Packet Lab ([Doc 05](05-packet-lab-analysis-and-spec.md)) is placed inside this plan, not ahead of it.

## 1. Where 2.0 stands today

### 1.1 Task register re-baselined

Doc 4 starts every task as Open because the repository was not available. Against the repo:

| Status | Count | Tasks |
| --- | --- | --- |
| Mostly done | 4 | 001 audit and 002 gap analysis (first pass in this pack; second-engineer review and doc edits remain), 007 migrations, 017 CI pipeline (no security scans yet) |
| Partial (about half done) | 16 | 003, 005, 008, 009, 010, 011, 013, 015, 016, 021, 022, 026, 028, 032, 043, 046 |
| Open | 36 | 004, 006, 012, 014, 018, 019, 020, 023, 024, 025, 027, 029, 030, 031, 033 to 042, 044, 045, 047 to 056 |

What this means in plain terms: the engineering foundation is real (permissions, sessions, rate limits, queues, audit, CI) but needs hardening; the product layer that makes 2.0 different is not started.

### 1.2 What is not in Doc 4 but must be done

[Doc 04](04-existing-project-deep-analysis.md) found defects that Doc 4 could not know about. They are added here as **Sprint 0** tasks and sit before any new feature, because 2.0's "verified skills" rest on the quiz and certificate code where most of them live.

| New task | Covers | Size | Overlaps |
| --- | --- | --- | --- |
| TASK-057 Regression tests that prove or clear the suspected defects | S-1, S-2, S-3, S-5, S-7 | S | TASK-008 test matrix |
| TASK-058 Fix the reset flow and proxy trust | S-2, S-3, S-11 (S-1 was refuted by test) | S | TASK-013 |
| TASK-059 Deletion semantics: delete the Supabase credential, anonymise instead of cascading shared content, block deleting a quiz that has certificates | D-1, D-2, S-5, S-9 | M | TASK-046 |
| TASK-060 Quiz integrity: attempt cap, retake gap, server deadline, expiry, certificate retention | S-7, D-4 | M | TASK-032 |
| TASK-061 Staff access: replace shared-secret admin signup with invitations; audit the clean-data action | S-4, S-6 | M | TASK-044, TASK-015 |

Net added effort after overlap is about 3 weeks for one developer (15 working days).

## 2. How big is "everything that is left"

### 2.1 Method and its limits

Doc 4 gives sizes (S, M, L). I converted them to working days for one full-stack developer including tests: **S = 3, M = 7.5, L = 15**. Done tasks count 10% (review), Partial 50%, Open 100%. This is an assumption, not a measurement. The only velocity evidence is the repo itself: one author, 56 commits, concentrated in 4 active calendar weeks inside an 8-week window (13 Aug to 9 Oct), delivering identity, seven content domains, forums, quizzes, realtime, notifications, an admin area and the Supabase mode. That is brisk, so treat the figures below as the upper half of a ±40% band, to be recalibrated after the first two sprints. Team size is not stated anywhere in the documents; it is the single biggest input to the calendar.

### 2.2 Effort by workstream (one developer)

| Workstream | Tasks | Remaining effort |
| --- | --- | --- |
| 1 Stabilise and foundations | 001 to 011, 013, 015 to 017 | 8.4 weeks (11 with Sprint 0) |
| 2 Identity v2 and trust | 012, 021 to 025, 046, 054 | 10.3 weeks |
| 3 Prove-lite | 014, 027, 032, 033, 034 | 9.0 weeks |
| 4 Design system and accessibility | 018, 019, 020, 050 | 7.5 weeks |
| 5 Community depth, Learn, Practice | 026, 028 to 031, 043 | 8.8 weeks |
| 6 Careers | 035 to 042, 052, 053 | 20.7 weeks |
| 7 Staff security, ops, rollout, AI, localisation | 044, 045, 047 to 049, 051, 055, 056 | 14.1 weeks |
| **Total** | **56 tasks** | **78.9 weeks, about 82 with Sprint 0** |

Reading it: one developer needs roughly 18 months for the whole of Doc 4. Careers alone is a quarter of it. With the ±40% band the range is about 50 to 115 weeks. The practical conclusion is that Doc 4's ten milestones cannot all be finished soon with one person, so the plan has to be re-sliced rather than followed in order.

### 2.3 Calendar by team size

Assumes parallel work is possible only across independent lanes (backend foundations, design system, identity and profile), plus about 20% coordination overhead.

| Team | Whole of Doc 4 | Release 1 to Release 3 (excluding the later part of workstream 7) | First useful release |
| --- | --- | --- | --- |
| 1 full-stack developer | about 82 weeks | about 77 weeks | about 12 weeks (Stabilise, section 5) |
| 2 (one backend-leaning, one front-end and design) | about 50 weeks | about 46 weeks | about 8 weeks |
| 3 (adds a second backend for careers and payments) | about 37 weeks | about 35 weeks | about 6 weeks |

## 3. What decides the sequence

### 3.1 Critical path

```
TASK-008 permission engine ──┬─▶ 012 field protection ──▶ 025 profile & consent ──▶ 038 forwarding & visibility
 (L, partial)                ├─▶ 013 limits, 015 audit ──▶ 043 moderation, 044 staff security
                             ├─▶ 014 private files ─────▶ 024 resume, 033 evidence ─▶ 034 badges
                             ├─▶ 027 taxonomy ──────────▶ 032 assessments, 028 content
                             └─▶ 035 company onboarding ─▶ 036 positions ─▶ 037 apply ─▶ 038 ─▶ 040 offers ─▶ 042 interviews
TASK-018 components (L) ─────▶ 019 shell ─▶ 020 states & a11y ─▶ every new screen
TASK-016 background work ────▶ 021 notifications ─▶ 042 reminders, 053 response nudges
TASK-039 payments ───────────▶ 040 placement-fee invoices (needs OPEN-07, OPEN-08)
```

Two tasks sit under almost everything: **TASK-008 (permissions)** and **TASK-018 (components)**. Starting either late delays every feature that depends on it. Both are partly built (008) or cheaply startable in slices (018).

### 3.2 Decisions that gate work

Recommended answers are in Doc 1 section 10 and Doc 01 section 4. The owner approves, changes or rejects.

| Pack | Decisions | Unblocks | Why now |
| --- | --- | --- | --- |
| **A. Needed to start (this week)** | Team size and release plan; DEC-035 member approval rule; DEC-036 restate the stack; OPEN-13 authentication policy | Stabilise, identity v2 | Everything in workstreams 1 and 2 |
| **B. Needed before identity ships (about week 6)** | OPEN-20 minimum age; OPEN-19 profile visibility; OPEN-06 retention (counsel); OPEN-04 and OPEN-18 notification rules and sender identity; OPEN-14 moderation policy; OPEN-01 and OPEN-02 colour and logotype | Workstreams 2 and 4 | Data model and screens depend on them |
| **C. Needed before Prove (about week 16)** | OPEN-03 verification labels; OPEN-05 assessment rules; DEC-037 where blogs, resources, recordings live in the module map; DEC-045 Packet Lab scope | Workstreams 3 and 5 | Taxonomy and badge design |
| **D. Needed before Careers (about week 30)** | OPEN-07 placement fee safeguards and legal review; OPEN-08 payment provider; OPEN-09 prices; OPEN-10 company onboarding; OPEN-11 hiring manager; OPEN-21 candidate protections; OPEN-12 ClickUp and n8n scope | Workstream 6 | The legal items have lead time; start the counsel review early |

**DEC-035 (member approval) in more detail**, because it changes the first screen every new member sees:

| Option | Behaviour | Effect | Assessment |
| --- | --- | --- | --- |
| 1 Keep manual approval | Admin approves every signup before any email is sent | Highest control, longest wait, unmeasured | Only if the measured wait (Doc 03 section 6.2 SQL) is short |
| 2 Verify first, limited access (recommended) | Send the verification email at registration; a verified member can read and finish their profile; posting and uploads stay behind approval | Removes the dead wait, keeps a safety net | Small change: move the first email earlier and relax the guard on read routes |
| 3 Automatic approval with signals | Approve if a work or university domain, LinkedIn URL or other check passes; queue the rest | Fastest, needs rules and monitoring | A later refinement of option 2 |

## 4. Ways to finish 2.0 (options)

| Option | Idea | Member-visible value | Time to first release (1 dev) | Main risk |
| --- | --- | --- | --- | --- |
| A. Follow Doc 4 as written | M0 to M9 in order | Late: careers arrive after about 15 months | About 12 weeks (foundations only) | Long gap with no new product; plan too big for the team |
| **B. Stabilise, then thin-slice the loop (recommended)** | Fix integrity and trust first, then deliver the smallest version of each loop step in order: profile, prove, practice, then careers | Early: verified skills and practice within about 6 months | About 12 weeks | Needs discipline to keep slices thin |
| C. Careers first | Build jobs and fees on today's profiles with self-declared skills | Revenue sooner | About 20 weeks to a pilot | Contradicts "evidence over claims"; the placement fee is unresolved legally (RISK-03); the stack of existing defects remains |

Option B keeps the product's differentiator (verified skills) ahead of the revenue feature (careers), as Doc 1 section 8 intends, while recognising that the existing quizzes and certificates already give a head start on proof.

## 5. Recommended plan (Option B)

Workstream numbers match section 2.2. Weeks are for one developer and fall by roughly 40% with two (section 2.3).

### Phase 1: Stabilise and foundations (about 11 weeks)

| Order | Work | Exit criteria |
| --- | --- | --- |
| 1a Sprint 0 (weeks 1 to 2) | TASK-057 and 058: tests then fixes for S-2, S-3 (S-1 was refuted by test), then S-11. Quick wins (section 6) | Tests fail before and pass after each fix; reset-token reuse and code guessing are closed |
| 1b (weeks 3 to 5) | TASK-059, 060, 061: deletion semantics, quiz integrity, staff invitations | Deleting a quiz with certificates is refused; credentials are removed on account deletion; admins can only be created by invitation |
| 1c (weeks 5 to 11) | TASK-003, 004 (restore drill), 005 (alerts and incident process), 006 (auth decision using Doc 04 section 3.3), 008 (route-by-role test matrix over all 102 endpoints), 009, 010, 011, 013, 015, 016; close 001, 002 with doc edits | Every route denies the wrong role in an automated test; a restore has been timed; alerts reach a named person; audit entries carry a reason |

### Phase 2: Identity v2 and trust (about 10 weeks, can start in week 8 with two developers)

| Work | Notes |
| --- | --- |
| TASK-022, 023 progressive registration, level choice, required details with a profile checklist | Existing members are grandfathered: they see "profile incomplete", and only applying (Release 3) is ever blocked |
| TASK-012 field-level protection | Needed before date of birth, CTC and contact fields exist |
| TASK-025, 046, 054 consent centre, data rights (export and erase with a grace period), privacy notice, community guidelines, fees and how-verification-works pages | Replaces the 24-line privacy page; main DPDP duties land about 14 May 2027 |
| TASK-021 notification preferences, quiet hours, delivery log | Reuses the existing queue and bell |
| TASK-024 resume upload and review | After TASK-014 (private files) |

### Phase 3: Prove-lite (about 9 weeks)

The thinnest version of verification that is still honest:

1. TASK-027 skill taxonomy (Major, Minor, Micro) with a suggestion queue.
2. TASK-032 assessment rules applied to the existing quiz engine and linked to skills.
3. TASK-014 private file pipeline, then TASK-033 evidence submission and Admin review (two checks, reason, appeal once).
4. TASK-034 badge lifecycle and the public "How verification works" page; "Assessment verified" and "Experience verified" first, "PP verified" later.

### Phase 4: Design system and accessibility (7.5 weeks, interleaved or on a second developer)

TASK-018, 019, 020, 050: tokens first with the old look preserved, then the Signal Grove switch, accessible dialog, error and loading boundaries, a screen-reader pass ([Doc 03](03-ux-research-analysis.md) backlog UX-02 to UX-09). Start the token and dialog slice in Phase 1 because every later screen reuses it.

### Phase 5: Community, Learn and Practice (about 9 weeks)

TASK-026 community upgrades (modes, accepted answer, report, guidelines), TASK-043 moderation queue with SLAs, TASK-028 and 029 content states and enrolment, TASK-031 mentoring. **TASK-030 labs is served by the Packet Lab** (Doc 05), which is how the missing Practice module is delivered without a lab runtime.

### Phase 6: Careers (about 21 weeks, starts when Pack D is approved)

TASK-035 to 042, 052, 053. Order inside it: company onboarding, positions, apply and fee consent, screening and forwarding with visibility, interviews, offers. Payments (TASK-039, 3 weeks) can follow the first pilot if invoices are issued manually at first.

### Phase 7: Staff security, operations, rollout, AI, localisation (about 14 weeks)

Pull **TASK-044 staff MFA and TASK-049 staged rollout** forward into Phase 2 and Phase 6 respectively; they are release blockers. The rest (045 analytics, 047 flags and policies, 048 integrations, 051 Hindi, 055 AI drafting, 056 monitoring) follow.

### Calendar view (one developer)

| Release | Contents | Weeks |
| --- | --- | --- |
| R1 Trustworthy foundation | Phase 1, Phase 2, token slice of Phase 4, TASK-044 | about 31 |
| R2 Prove and practise | Phase 3, Phase 5, Packet Lab E1 to E3 | about 22 |
| R3 Careers | Phase 6, TASK-049 rollout | about 24 |
| R4 Intelligence and ecosystem | Rest of Phase 7 | about 8 |

## 6. Quick wins (each about one day or less, no decisions needed)

| # | Change | Fixes | Source |
| --- | --- | --- | --- |
| 1 | ~~Fix `GET /quizzes` for anonymous visitors~~ Not needed: tests show drafts never leak (S-1 refuted); the tests stay as a guard | S-1 | Doc 04 |
| 2 | Add `error.tsx`, `not-found.tsx`, `loading.tsx` and a `global-error` boundary | DES-001 | Doc 03 |
| 3 | Add a skip link and honour `prefers-reduced-motion` | DES-004 | Doc 03 |
| 4 | Send a "we got your request" email at registration that explains approval and what happens next | UX-01 | Doc 03 |
| 5 | Remove or clearly label the simulated "Network Snapshot" | DES-003 | Doc 03 |
| 6 | Replace the emoji and colour-only status on the certificate page with text and glyph | DES-007 | Doc 03 |
| 7 | Make the certificate number longer and random; rate-limit the public verifier | S-8 | Doc 04 |
| 8 | Add the `reason` field to the audit log and write an audit row for clean-data | S-6 | Doc 04 |
| 9 | Fix README (Next 16, Supabase mode, admin invitation steps) and recover or summarise the "plan" documents the code cites | Doc 04 section 8 | |
| 10 | Move the verification email to registration under DEC-035 option 2 | UX-01 | Doc 03 |
| 11 | Wire a basic uptime check and error alert to a named owner | OPS-02 | Doc 4 |
| 12 | Write the first five regression tests (S-1, S-2, S-3, S-5, S-7) | | Doc 04 |

## 7. Migrating the existing 2,000 members without disruption (RISK-05)

1. **Additive migrations only**: new tables and nullable columns first; no destructive change until after the rollout rehearsal.
2. **Feature flags**: the existing singleton `SiteSettings` row is a natural home; add a `FeatureFlag` table (TASK-047) so each phase ships dark and opens gradually: staff, then a pilot group, then everyone.
3. **Grandfathering**: current members keep access. New required fields (date of birth, domain, current role) appear as a profile checklist; nothing blocks them until they apply for a job.
4. **Quiz and certificate continuity**: freeze deletion of quizzes with certificates (TASK-059) before changing the quiz model; existing certificates become the first "Assessment verified" evidence records through a one-time, reviewable backfill.
5. **Rollback**: every release has a documented way back (disable flag, revert deploy, restore point) tested on a production-like copy (TASK-049, TEST-043).
6. **Communication**: tell members what changed and why in plain language (Doc 2 section 11); keep the support address monitored.

## 8. Scope levers (if the calendar must shrink)

| Lever | Weeks saved (1 dev) | Cost |
| --- | --- | --- |
| Defer Hindi (TASK-051) | 1.5 | PRD-048 slips |
| Defer AI drafting (TASK-055) | 1.5 | None for launch (AI is a Release 4 item) |
| Defer ClickUp and n8n (TASK-048) | 1.5 | Manual operations tracking |
| Defer deeper analytics (TASK-045) | 1.5 | Fewer funnel metrics; keep the five events in Doc 03 |
| Defer payments (TASK-039); invoice manually in the pilot | 3 | Manual billing for early placements |
| Resume parsing later; manual entry first (TASK-024) | 1.5 | Longer profile completion |
| Candidate compare view later (TASK-041) | 1.5 | Recruiters review one at a time |
| Calendar invites later; email-only interviews (TASK-042) | 1.5 | Less polish |
| Mentoring later (TASK-031) | 0.6 | PRD-027 slips |
| **Total available** | **about 14** | |

Not recommended to cut: TASK-008, 013, 015 (security), 046 (data rights), 049 (rollout), 050 (accessibility), or Sprint 0.

## 9. Risks specific to finishing the work

| Risk | Effect | Mitigation |
| --- | --- | --- |
| One-developer capacity and key-person dependence | Plan slips; knowledge sits with one person | Document decisions in the repo; two-person review for money, consent, permissions (Doc 4 section 10); add a second developer if the owner wants Careers within the year |
| Scope returns through the side door | Calendar doubles | Phase gates, the lever list above, DEC-045 style scope decisions recorded |
| Legal lead times (placement fee, retention, DPDP notice) | Careers and data rights stall | Start counsel review during Phase 1 |
| Quiz model changes disturb existing certificates | Credibility loss | Sprint 0 first, backfill under review, no deletion path |
| Design re-skin touches every screen | Long tail of visual bugs | Tokens first, then one value switch; visual regression screenshots for the 10 main routes |
| Free-tier backend limits | Slow first load during rollout | Move to a paid instance before R1 traffic (RISK-06) |
| Content correctness (Packet Lab, taxonomy, assessment banks) | Wrong teaching | Named reviewers, tshark oracle for Packet Lab (Doc 05 section 7) |

## 10. Where the Packet Lab fits

| When | What |
| --- | --- |
| After Sprint 0, in parallel with Phase 2 if a second developer exists | Packet Lab Phase 0 spike: engine core, ping on the LAN, tshark-verified capture. It touches no backend and no existing tables, so it does not compete with Stabilise |
| Phase 3 to Phase 5 | Packet Lab Phase 1 (E1 to E3, the A-to-Z page load) becomes the first Practice content and replaces the fake Network Tools (DEC-042) |
| With Phase 3 | Link each scenario to a quiz and a skill, so completion feeds the verified-skills model |

This keeps its value (the missing Practice module, public acquisition pages) without delaying the integrity and trust work that it depends on.

## 11. Definition of done for each phase

| Phase | Done when |
| --- | --- |
| 1 | Sprint 0 tests green; route-by-role matrix passes for all endpoints; a timed restore on staging; alerts reach a named owner; docs 1 to 4 updated and reviewed by a second person |
| 2 | A new member registers, finishes required details, sets consent and can export or erase their data in staging; privacy notice approved by counsel; existing members migrated without losing access |
| 3 | A passing quiz or an approved evidence item shows a labelled, dated, expiring badge on the profile; the public criteria page matches the agreed wording |
| 4 | Ten main routes pass axe, keyboard-only and a screen-reader check in light and dark; components show every state |
| 5 | Questions have modes and accepted answers; reports reach a queue with a service level; Packet Lab E1 to E3 verified |
| 6 | A hire completes end to end in staging with the fee flow, visibility rules and audit trail |
| 7 | A staged rollout and a rollback are rehearsed and signed off |

## 12. Questions for the owner

1. **Team size and availability.** One developer or more? This decides whether Careers lands this year.
2. **DEC-035.** Do you accept option 2 (verify first, limited access)? The SQL in Doc 03 section 6.2 will say how long members wait today.
3. **Counsel.** Can the placement-fee and data-retention review start now?
4. **Release 1 target date.** The DPDP main duties date (about 14 May 2027) is the natural deadline for consent, export and erasure.
5. **Approve Sprint 0** so work can begin on a branch with tests first.

## 13. Not verified

Team capacity and any dates; real velocity beyond the git history; production data and the actual approval wait; counsel's view on the fee and retention; the effect of free-tier limits on rollout; and whether the "Likely" defects in Doc 04 reproduce (Sprint 0 task 057 settles that).
