# 03. UI/UX Research and Analysis

Part of the [research pack](00-index.md). Measures the shipped web app (`apps/web`, HEAD `dc44af1`) against Doc 2 (Design System and UX Guide) and Doc 3 (Users, Screens and Page Flows), then sets out the research needed to replace hypotheses with evidence.

**Method and limits.** This is a static review of 173 components and 43 pages, plus targeted code searches. The app was not run, so nothing below was seen on a screen: contrast, spacing and motion findings are predictions from class names and tokens. No users were interviewed or observed. Severity: **S1** blocks a legal, safety or core-task outcome; **S2** harms a main journey or breaks a DES rule everywhere; **S3** polish.

## 1. What the shipped UI is

| Aspect | Shipped | Evidence |
| --- | --- | --- |
| Look | Dark-only "glassmorphism": frosted translucent panels, blurred indigo, purple and cyan blobs, animated gradient lines, gradient hero text | `globals.css`, `Hero.tsx`, `Button.tsx` |
| Theme | `<html class="dark">` hard-coded; a light token set exists but is unreachable; no theme switch; toasts forced to `theme="dark"` | `app/layout.tsx`, `AdminShell.tsx`, `WorkflowShell.tsx` |
| Colour | shadcn HSL tokens for neutrals, but the brand is literal Tailwind classes: 110 uses of indigo, purple, violet, cyan, fuchsia. Primary button is an indigo to purple gradient | `tailwind.config.ts` header comment says so |
| Type | Inter name referenced, falls back to the system stack (fonts not fetched); no JetBrains Mono, no Devanagari | `globals.css` `--font-inter` |
| Shell | Fixed 256 px left sidebar from `lg`, slide-over below; top bar; command palette (cmdk); notification bell; no bottom bar on phones | `AppSidebar.tsx`, `AppTopbar.tsx`, `CommandPalette.tsx` |
| Components | 10 primitives (Accordion, Alert, AnimatedCard, Badge, Button, Card, DataTable, Dialog, Select, Table, Tooltip) plus shared Pagination, Breadcrumbs, CalloutBox | `shared/ui/primitives` |
| Forms | Native inputs styled inline per form, React Hook Form and Zod on auth and profile, hand-rolled state on the new-thread form | `RegisterForm.tsx`, `NewThreadForm.tsx` |

## 2. Design-system drift against Doc 2

| Doc 2 rule | Shipped | Gap | Cost |
| --- | --- | --- | --- |
| DEC-003 Signal Grove, light-first; dark is a designed alternative (DES-006) | Dark-only; light mode untested and likely broken (e.g. `text-gray-300` hero copy would be near-invisible on a light page, inferred) | Total | Re-skin of every screen |
| Brand forest `#156152`, one primary colour (OPEN-01) | Indigo-to-purple gradient primary; indigo active nav; a "secondary" button in white with indigo text | Total | Replace `buttonVariants` and 110 literals |
| Module accents: Community forest, Learning indigo, Recruitment blue, Payments plum (DEC-005) | One accent everywhere; no module identity | New concept | Add accent tokens; map content areas to modules |
| Semantic colours with glyph and text (DEC-007, DES-007) | Success is green text with a ✅ emoji on the certificate page; errors are red text; no shared glyph chips. The `Badge` and `Alert` primitives exist but status is not consistently routed through them (not audited) | Partial | Status chip component with glyph |
| Tokens defined once, no raw values in components (DES-005, s14) | Literals throughout; glass recipe is shared in CSS, which is good | Large | Token pass before re-skin |
| Typography: Inter plus JetBrains Mono, 16/24 body | System stack; text sizes mix `text-xs` and `text-sm` for body-adjacent content; four uses of 9 to 11 px text | Partial | Load fonts, set scale |
| Elevation: borders first, shadows for real layers | Glass blur, glow shadows and gradient lines on ordinary cards | Opposed | Remove glow and blur from content surfaces; keep blur for overlays only |
| Illustration: subtle low-opacity lines, never behind dense text | Animated pulsing blobs behind the hero; `animate-pulse` on decorative layers | Partial | Static or reduced-motion-safe |
| Mobile: bottom bar below 1024 px; tables become stacked cards | Slide-over sidebar; `DataTable` and `Table` primitives with no card fallback found (not audited at runtime) | Gap | New nav and table pattern |
| Page header: icon tile, one H1, one primary action | H1 plus subtitle, no icon tile or standard header component | Gap | `PageHeader` component |

**Take-away.** The shipped system is a coherent but different design language. Signal Grove cannot be reached by editing tokens alone because the colour decisions live in class names. Recommended sequence: (1) token and component layer first with the old look preserved (DES-005), (2) switch the token values, (3) delete the glass recipes. This is what lets TASK-018 and TASK-019 land without a big-bang visual change (RISK-05).

## 3. Heuristic audit against DES-001 to DES-012

| Rule | Finding | Sev | Evidence |
| --- | --- | --- | --- |
| DES-001 every screen has loading, empty, error, success | No `loading.tsx`, `error.tsx`, `not-found.tsx` or `global-error.tsx` in the whole app; the only skeleton loader is inside the `DataTable` primitive. Empty states are single grey sentences with no next action ("No resources yet.", "No quizzes published yet.", "No posts yet.") | S2 | `find` of `app/`; `resources/page.tsx:44`, `quizzes/page.tsx:32`, `blogs/page.tsx:53` |
| DES-001 server errors | A failing server fetch throws on the page (certificate verify rethrows any non-404) and falls to the framework default error page | S2 | `certificates/verify/[number]/page.tsx` |
| DES-003 explainable automation | Dashboard "Network Snapshot" (uptime, networks, devices, alerts) and Network Tools output are generated numbers; only the dashboard block carries a "Simulated" badge | S2 | `dashboard/page.tsx`, `network-tools.service.ts` |
| DES-004 accessibility is a speed feature | See section 5 | S2 | |
| DES-008 one primary action per view | Mostly followed in forms. The hero has one gradient button plus one outline link, which is acceptable. Admin tables repeat primary-styled row buttons (not audited) | S3 | `Hero.tsx` |
| DES-009 where am I, what changed, what next | Dashboard shows site-wide totals rather than the member's own progress or a next step. Registration success sends the member to `/login?registered=true` with no explanation that an admin must approve before email arrives (inferred from the flow below) | S1 | `dashboard/page.tsx`, `RegisterForm.tsx`, `email-verification.service.ts` |
| DES-010 plain language | Mostly plain. "Welcome to Packet Pulse Community" splits the product name; brand is "PacketPulse" elsewhere | S3 | `Hero.tsx` |
| DES-011 ask only what is needed, say why | Registration collects WhatsApp (optional) and experience level with no stated purpose or who sees it. Doc 2 s11.1 requires "why we ask" on sensitive fields | S2 | `RegisterForm.tsx` |
| DES-012 recoverable work | New-thread form keeps state in React only: no draft save, no unsaved-changes warning, no error message at all when posting fails (the form renders only a submit button that reads "Posting…"). Deletes use the native `confirm()` that names the item but not the effect | S2 | `NewThreadForm.tsx`, `CategoriesTable.tsx:148` |
| Forms (Doc 2 s10): linked and announced errors | Errors are `<p>` text under fields with no `aria-describedby`, `aria-invalid` or `role="alert"`; no error summary on long forms; password and confirm-password fields both required, and a live rules checklist is a good pattern | S2 | `RegisterForm.tsx` |
| Buttons: loading keeps label | Submit label swaps to "Creating account…" and disables: acceptable | OK | `RegisterForm.tsx` |
| Dialogs: focus in, return focus, labelled | Hand-rolled dialog: Escape and backdrop close only. No focus trap, no `role="dialog"`, no `aria-modal`, no `aria-labelledby`, no scroll lock, no focus return. The source comment calls the focus trap a "known a11y gap" | S1 for admin destructive dialogs | `Dialog.tsx` |
| Toasts: not the only place for required info | Sonner toasts in profile and quiz flows; whether any result is toast-only is not audited | S3 | |
| Breadcrumbs on deep pages | Component builds crumbs by title-casing URL segments, so detail pages show raw IDs ("Forums > 3f2a…"), inferred | S3 | `Breadcrumbs.tsx` |
| Navigation by role (Doc 3 s2.2) | One member list of seven items plus Admin; no mentor, instructor or reviewer items; command palette lists a subset and hard-codes admin entries | S2 | `AppSidebar.tsx`, `navigation.ts` |
| Skip link, focus to H1 on route change (Doc 2 s10) | None found | S2 | grep for skip link |
| Reduced motion (Doc 2 s10, s13) | No `prefers-reduced-motion`, `motion-reduce` or `useReducedMotion` anywhere, despite framer-motion, pulsing blobs and count-up numbers | S2 | grep across `src` |
| Hindi and longer text (Doc 2 s12) | No i18n; `lang="en"` fixed; fixed-width constructs not audited | S3 | |

## 4. Accessibility signals against Doc 2 section 13

| Area | Standard | Signal found | Verdict |
| --- | --- | --- | --- |
| Contrast | 4.5:1 text, 3:1 controls | Unmeasured. Dark theme with grey-300/400 copy on near-black is likely fine; light theme unusable as shipped (inferred). Indigo-400 text on dark glass is the common accent (likely ~6:1, unverified) | Unknown |
| Keyboard | All operable, visible focus | `Button` has a 2 px `focus-visible` ring. Raw inputs, selects, links and icon buttons inherit browser defaults (5 files strip outlines). Only one file uses `focus-visible` | Weak |
| Structure | Landmarks, one H1 | Pages render one H1 and a `<main>`; landmark coverage in shells not audited | Unknown |
| Names | Every control named | 13 ARIA attributes across 173 components; icon-only buttons (dialog close, sidebar close) have no accessible name | Weak |
| Targets | 40 px | Buttons `h-10`, inputs about 40 px; icon buttons `h-10 w-10` | Pass (inferred) |
| Status | Text and glyph, not colour alone | Emoji ✅ and coloured text; badges are colour-led | Partial |
| Reflow | 320 px, 200% zoom | `overflow-x: hidden` on `html, body` can hide overflow rather than prevent it; fixed 256 px sidebar becomes a slide-over | Risk |
| Motion | Respect reduced motion | Not implemented | Fail |
| Real AT | Screen reader pass | None recorded | Fail by default (RISK-10) |

Doc 2 s13 claims prototype scans were clean; the same bar has not been applied to this codebase. The first step is an automated scan (axe via the browser) of the ten highest-traffic routes, then a manual keyboard pass, before any redesign work.

## 5. Journey analysis

### 5.1 Sign-up to first value (WF-001), as shipped

| Step | What happens | Friction and risk |
| --- | --- | --- |
| 1 | Visitor lands on `/` (marketing hero, "Join over 2000+ network professionals") | Promise is community and resources; no fees, no loop, no proof of outcomes |
| 2 | `/register`: 7 fields (first, last, email, WhatsApp, experience, password, confirm) plus terms | Long for a first screen; WhatsApp purpose unexplained; confirm-password adds a field that show-password would replace; 8 chars with four complexity rules conflicts with the 12 chars, no-complexity policy Doc 1 recommends |
| 3 | Redirect to `/login?registered=true` | Member is told nothing about approval or a verification email. No email is sent yet (`email-verification.service.ts`: first email goes out at admin approval) |
| 4 | **Wait for admin approval** (unbounded) | The biggest drop-off candidate. No status page, no ETA, no way to nudge, no notification channel (WhatsApp was collected but not used for this) |
| 5 | Approval email also carries the verification link (24 h) | Link expiry can lapse with no reminder beyond an admin-triggered resend (`ResendVerificationBanner`) |
| 6 | First login: dashboard of site totals | No next step, no profile prompt, no first-action nudge; welcome copy shows approval state |

Target per Doc 3 s1.1 is: Home, Fees, Join, verify code, choose level, details, resume, consent, Dashboard, first action. Doc 1 s3.1 sets 60% profile-ready within 7 days. With a manual approval in the middle, that target depends on admin response time, which no one is measuring.

**Proposal for DEC-035:** keep a safety net but remove the wait. Let members verify email immediately and see a limited "Welcome" state (read public content, complete profile, take a first action such as a quiz); gate only high-risk actions (posting, uploading) behind approval, or approve automatically when a work or education email domain, LinkedIn URL or resume passes basic checks. Decide with the data from section 6.2.

### 5.2 Prove a skill (WF-002, WF-003), as shipped

Quiz list, attempt, score, certificate with public number, public verifier page. This is the strongest foundation: it already shows who, when and a stable link. Gaps against the design: no skill link, no label taxonomy (Doc 1 s10.1), no expiry shown, no evidence, no reviewer, and the verifier page displays the member's full name with no consent record. Friction: the certificate page's only action is read; no share-to-LinkedIn or add-to-profile path; the `CopyVerifyLinkButton` is the sole share affordance.

### 5.3 Ask and answer (WF-005), as shipped

Create a thread with category, title, body; reply with nesting; like replies; moderators pin, lock, delete. Missing against Doc 3: question mode, minimum lengths, sensitive-data confirmation (important for a network-engineering audience that may paste configs), accepted answer, follow, report. The most consequential UX gap is no accepted answer: it removes the "reputation rewards usefulness" loop at the root (PRD-026).

### 5.4 Admin queue (WF-008), as shipped

`/admin` shows stats, pending-approval banners and recent activity; individual tables approve or unapprove. Missing: reason capture on decisions (Doc 1 PRD-014, PRD-028), step-up confirmation, SLA timers (reports acknowledged in 24 hours), bulk actions, and a single "needs attention" queue. Admins carry both approval and moderation, with no separate moderator surface in the nav.

## 6. Research plan: replacing hypotheses with evidence

### 6.1 What we need to learn

| # | Question | Why it matters | Linked decisions |
| --- | --- | --- | --- |
| R1 | How long do members wait for approval, and how many never come back | Whether DEC-035 is urgent | DEC-035, PRD-001, Doc 1 s3.1 |
| R2 | What do fresher and experienced members actually want first: a course, a lab, a job, an answer | Whether the dashboard's next-step logic and the loop framing are right | SCR-004, Doc 1 s4 |
| R3 | Do members understand verification labels, and does "PP verified" read as stronger than "Assessment verified" | The label set is the trust product | OPEN-03, PRD-012, SCR-045 |
| R4 | Do members understand and accept a 1% placement fee shown on the role | A trust-critical, legally sensitive choice | OPEN-07, DEC-016, PRD-037 |
| R5 | What recruiters need to shortlist from a forwarded profile, and what they distrust | Whether evidence view beats a resume | SCR-020, PRD-032 |
| R6 | Which of the existing features (blogs, resources, recordings, network tools, forums, quizzes) are actually used | Which survive in the module map | DEC-037, DEC-039 |
| R7 | Can people complete the key flows with a screen reader and on a phone | Release bar for WCAG 2.2 AA | PRD-049, TEST-036, TEST-037 |
| R8 | Do forest-green primary actions test better than the current indigo, and does light-first suit the audience | Confirms OPEN-01 and DEC-003 with evidence | OPEN-01, DEC-003 |

### 6.2 Data that already exists (do this first, no users needed)

Run on a read replica or a database snapshot. Table and column names are from `schema.prisma`.

```sql
-- R1: approval wait and conversion
SELECT
  count(*)                                                        AS registered,
  count(*) FILTER (WHERE is_approved)                             AS approved,
  count(*) FILTER (WHERE email_verified)                          AS verified,
  count(*) FILTER (WHERE last_login_at IS NOT NULL)               AS ever_logged_in,
  percentile_cont(0.5) WITHIN GROUP (ORDER BY approved_at - created_at) AS median_wait,
  percentile_cont(0.9) WITHIN GROUP (ORDER BY approved_at - created_at) AS p90_wait
FROM users;

-- R1: monthly cohort funnel
SELECT date_trunc('month', created_at) AS cohort,
       count(*) AS registered,
       count(*) FILTER (WHERE is_approved) AS approved,
       count(*) FILTER (WHERE email_verified) AS verified,
       count(*) FILTER (WHERE last_login_at > created_at + interval '7 days') AS returned_after_7d
FROM users GROUP BY 1 ORDER BY 1;

-- R6: feature use (counts are rough proxies; views/downloads are on the rows)
SELECT 'threads' AS feature, count(*) FROM forum_threads
UNION ALL SELECT 'replies', count(*) FROM forum_replies
UNION ALL SELECT 'quiz_attempts', count(*) FROM quiz_attempts
UNION ALL SELECT 'certificates', count(*) FROM certificates
UNION ALL SELECT 'blog_posts', count(*) FROM blog_posts
UNION ALL SELECT 'resources', count(*) FROM resources
UNION ALL SELECT 'recordings', count(*) FROM recordings;

-- R6: distinct active authors per feature, last 90 days
SELECT 'forum' AS f, count(DISTINCT author_id) FROM forum_threads WHERE created_at > now() - interval '90 days'
UNION ALL SELECT 'quiz', count(DISTINCT user_id) FROM quiz_attempts WHERE started_at > now() - interval '90 days';
```

Also pull: self-reported `professional_experience` split (fresher versus experienced proxy), `whatsapp_number` fill rate, and `admin_activity_logs` counts by action to see what admins actually spend time on. Use the `ClientLog` table for front-end error rates by route.

### 6.3 Qualitative and usability studies

| Study | Method | Sample | Tasks or prompts | Output |
| --- | --- | --- | --- | --- |
| A. Member discovery interviews (R2, R6) | 30 minute remote interviews, recent signups (1 to 6 months), mix of fresher and experienced | 8 to 10 | Walk me through the last time you used PacketPulse; what did you come for; what did you do instead; show your job-search routine | Jobs-to-be-done map, ranked pains, the "first 10 minute win" candidate |
| B. Recruiter discovery interviews (R5) | 30 minute interviews with in-house recruiters and agencies who hire network, security or cloud engineers | 5 to 6 | Shortlist walkthrough using real resumes; what makes you trust a skill claim; how do you treat certificates; fee expectations | Evidence-view requirements, scorecard validation (PRD-033), company-onboarding friction |
| C. Verification label comprehension (R3) | Unmoderated card sort plus 5-second test on five label designs | 20 to 30 | Rank labels by strength; what does each mean; would you trust this on a profile | Pass/fail on label wording; decides OPEN-03 |
| D. Fee comprehension (R4) | Moderated concept test on the role page, apply step and accept-offer dialog | 8 to 10 candidates, 3 to 5 recruiters | Explain what you would pay and when; when would you feel misled | Copy and placement changes; counsel inputs |
| E. Usability test on the current app (R1, R7) | Moderated think-aloud on register, quiz attempt, new thread; one session on phone, one with a screen reader | 5 desktop, 3 phone, 2 to 3 AT users | Sign up and get started; take a quiz; ask a question about a config | Severity-rated issue list that sets the Release 1 UX backlog |
| F. Colour and theme preference (R8) | Preference test with 2 to 3 high-fidelity screens in forest-light, forest-dark, current indigo-dark | 20 | Which feels credible; which would you recommend to a colleague; first-click on the primary action | Evidence for OPEN-01 and the theme default |
| G. Accessibility audit (R7) | Axe scans on 10 routes, keyboard-only walkthrough, NVDA and VoiceOver pass on register, quiz and thread | Team plus 2 AT users | Per Doc 2 s13 table | WCAG gap list and TEST-036 baseline |

Recruitment: use the existing WhatsApp numbers (consent-checked), the community forum and a LinkedIn post. Offer a small thank-you where policy allows. Tag any participants as research participants and do not copy their data into documents (Doc 4 s3 rule).

Order: section 6.2 data (days), then A, E, G in parallel (two weeks), then B, C, D, F once the label set and screens exist. A and E report before M2 (design system and shell) starts, so findings shape the components rather than follow them.

### 6.4 Metrics to instrument now

Doc 1 s4 lists the events; none exist in the code (no analytics provider found). Start with five that answer R1 and R2: `USER_REGISTERED`, `EMAIL_VERIFIED`, `FIRST_LOGIN`, `FIRST_ACTION` (thread, reply, quiz attempt, resource view), and `APPROVAL_WAIT_SECONDS`. No personal data in events (OPEN-16).

## 7. Reference patterns worth studying

Practitioner knowledge of common patterns, not sourced for this pack; check each against the live product before copying.

| Need | Pattern to study | Takeaway for PacketPulse |
| --- | --- | --- |
| Credible badges | Digital-credential platforms show issuer, criteria, evidence and an expiry on the badge detail | Matches Doc 1 s10.1; make the detail view the product |
| Q&A quality | Stack Exchange style accepted answer, voting, bounty, close reasons | Accepted answer and report reasons are the minimum; a "needs details" prompt reduces low-quality posts |
| Lab learning for networking | Simulator-based labs in the Cisco ecosystem and open lab tools | Start with written scenarios (Doc 1 s3.2); screenshots of topology plus a log excerpt is a feasible first lab |
| Candidate controls | Large job networks let members hide from named employers and show response status | Supports PRD-050, PRD-051, PRD-053 |
| Progressive profile | Short sign-up, profile completed through use | Replaces the 7-field first screen |
| Consent UI | Specific purpose and recipient before each sensitive field | Needed for DPDP and for DES-011 |

## 8. Ranked UX backlog

Effort is S, M or L. "Doc 4" names the existing task each item belongs to; items with none are proposed additions.

| ID | Item | Sev | Effort | DES rule | Doc 4 task |
| --- | --- | --- | --- | --- | --- |
| UX-01 | Decide and redesign the approval gate; add a pending-status screen with ETA and an email at registration | S1 | M | DES-009 | proposed (with DEC-035), TASK-023 |
| UX-02 | Replace the hand-rolled `Dialog` with an accessible one (focus trap, role, labelled, scroll lock, return focus) and use it for all destructive actions | S1 | S | DES-004, DES-012 | TASK-018, TASK-020 |
| UX-03 | Add `loading`, `error`, `not-found`, `global-error` boundaries and shared empty-state component with a next action | S2 | M | DES-001 | TASK-020 |
| UX-04 | Form pattern: linked errors (`aria-describedby`, `aria-invalid`), error summary, visible focus ring on every input, "why we ask" text, unsaved-changes guard | S2 | M | DES-004, DES-011, DES-012 | TASK-020 |
| UX-05 | Run axe on ten routes and a keyboard pass; add a skip link, focus-to-H1 on route change, `prefers-reduced-motion` support | S2 | M | DES-004 | TASK-050 baseline |
| UX-06 | Token layer: move all colour to semantic tokens, define module accents and semantic chips with glyphs; keep the old look until values switch | S2 | L | DES-005 | TASK-018 |
| UX-07 | Reskin to Signal Grove, light-first with a designed dark theme and a theme switch; remove glow, blur and ambient animation from content surfaces | S2 | L | DES-006 | TASK-018, TASK-019 |
| UX-08 | Navigation by role with the mobile bottom bar (five items plus More); role-aware command palette | S2 | M | Doc 3 s2.2 | TASK-019 |
| UX-09 | Member dashboard: loop tracker, next step, profile completeness, getting-started list; remove or relabel simulated data | S2 | M | DES-003, DES-009 | proposed, SCR-004 |
| UX-10 | Registration slim-down: email, password and level first; the rest progressively; 12-character passphrase policy with breach check; consent recorded | S2 | M | DES-011 | TASK-022, TASK-023, TASK-025 |
| UX-11 | Forum upgrades: question mode, minimum lengths, sensitive-data confirmation, accepted answer, report, guidelines link | S2 | M | Doc 3 WF-005 | TASK-026 |
| UX-12 | Notifications page, preferences, quiet hours | S2 | M | PRD-041 | TASK-021 |
| UX-13 | Privacy notice, consent centre and data-rights screen to replace the placeholder policy | S1 | M | Doc 3 SCR-038 | TASK-025, TASK-046 |
| UX-14 | Breadcrumbs from real titles, not URL segments | S3 | S | Doc 2 s7 | TASK-019 |
| UX-15 | Load Inter and JetBrains Mono; type scale with 16/24 body and 14/20 small; remove 9 to 11 px text | S3 | S | Doc 2 s5 | TASK-018 |
| UX-16 | Table-to-card pattern on phones for all admin and list tables | S3 | M | Doc 2 s7 | TASK-020 |
| UX-17 | Hindi switch and 30% length allowance | S3 | M | PRD-048 | TASK-051 |
| UX-18 | Certificate page: share and add-to-profile actions; show validity; glyph and text status instead of emoji | S3 | S | DES-007 | TASK-034 |

**Suggested first slice (about two weeks of design and front-end, inside M0 and M2):** UX-02, UX-03, UX-04, UX-05, then UX-06 behind the existing look. These carry no visible change for members, remove the largest a11y risks, and make every later screen cheaper.

## 9. Not verified

Anything about how the app renders or behaves in a browser; contrast ratios; mobile layout; whether every status in the admin tables uses `Badge`; toast-only results; real usage figures; and everything about users, who were not studied. Each "inferred" label above should be confirmed by section 6.3, study E and G, before it is treated as a defect.
