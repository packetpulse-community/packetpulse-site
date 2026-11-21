# 14. Policy Review Pack for the Core Admins

Part of the [research pack](00-index.md). Prepared 21 Nov 2026 from the code and documents at the head of `feat/2.0-stabilise`.

> **This is not legal advice.** Nobody who wrote this is a lawyer. Where the pack says "suggested" or "recommended", that is a starting point for a human decision, not a legal opinion. Section 6 lists the items a lawyer must check before anyone votes on them.

**Who this is for:** the community's core admins. You do not need to be technical or a lawyer. You need to read each item, tick one box, and send the answer sheet back.

**What this is:** every rule the build has chosen so far that a person must approve. The build had to pick *something* so the software could work. Each pick is called a *default*. Nothing is final until you answer.

---

## 1. Executive summary

### What we need from you

1. Read the 10 priority decisions below (about 40 minutes).
2. Tick one box for each: **Approve**, **Change to ...**, or **Discuss**.
3. Send back the answer sheet in section 9.
4. Hand the legal items in section 6 to your lawyer. Do not vote on those until they have answered.

You can answer the first 10 and leave the rest for later. The rest are in sections 4.1 to 4.12.

### The 10 decisions that block the most work (in priority order)

| Rank | ID | Decision | Why it blocks work | Needs a lawyer? |
| --- | --- | --- | --- | --- |
| 1 | PR-01 | Do new members wait for admin approval, or get in after verifying their email? (DEC-035) | It sets the first screen every new member sees, and the admin workload. The switch is built; the choice is not made. | No |
| 2 | PR-02 | The wording of the Terms, Privacy Policy and the two optional sharing consents | Members tick these at sign-up. Today the texts are one-sentence summaries. The Privacy page is still a placeholder. | **Yes** |
| 3 | PR-04 | Minimum age of 18 (OPEN-20) | Already enforced. Changing it later is hard once members have joined. | **Yes** |
| 4 | PR-32 | How long each kind of data is kept (OPEN-06) | Deletion jobs run on these numbers today. | **Yes** |
| 5 | PR-31 | What is erased, anonymised or kept when a member deletes their account | Members are told this on the Data rights page. | **Yes** |
| 6 | PR-10 | The community guidelines text and the ladder of consequences (OPEN-14) | Every member must accept it before the first post. It promises things the product cannot do yet. | Partly |
| 7 | PR-07 | Profile privacy defaults (OPEN-19) | Decides who can see a member's details from day one. | Partly |
| 8 | PR-17 | Quiz rules: attempts, retake gap, validity (OPEN-05) | The built default and the plan disagree on the retake gap. Certificates depend on it. | No |
| 9 | PR-39 | Admin security: two-step sign-in for staff, and how admins are created (OPEN-13) | Staff accounts can approve members, delete data and change switches. No second factor exists yet. | No |
| 10 | PR-23 | Notification rules: quiet hours, daily cap, critical exceptions (OPEN-04) | Waiting on your sign-off before any email provider or WhatsApp work. | No |

### The one-line recommendation for each of the top 10

| ID | Recommended answer |
| --- | --- |
| PR-01 | Keep admin approval for now. Turn on instant access only after the wait time is measured and a "review later" queue exists. |
| PR-02 | Have a lawyer write the full texts. Keep the current summaries as the short form. |
| PR-04 | Keep 18+. Ask the lawyer to confirm. |
| PR-32 | Keep the suggested periods as a draft. Do not treat them as final until a lawyer has seen them. |
| PR-31 | Approve the table. Ask the lawyer about certificates and the audit log. |
| PR-10 | Approve the rules. Either build the appeal and warning steps or change the text so it does not promise them. |
| PR-07 | Keep everything private by default. |
| PR-17 | Keep 3 attempts and a 70% pass mark. Set a 7-day retake gap. Decide the validity period. |
| PR-39 | Require a second factor for admins before the public launch. Retire the shared admin sign-up code now. |
| PR-23 | Approve as built. |

---

## 2. How to answer (one page)

1. **Read the box.** Each decision is a short block with the same lines: *Today*, *Where it lives*, *Why*, *Options*, *Recommended*, and a row of tick boxes.
2. **Tick one box.**
   - **Approve** means "keep what the build chose."
   - **Change to ...** means "use this instead." Write your value on the line.
   - **Discuss** means "I am not ready." Say what worries you. We will bring it to the open call.
3. **"Needs a lawyer" items.** Tick **Discuss** unless your lawyer has already answered. Write the lawyer's name and date on the line.
4. **Do not guess.** If a term is unclear, look it up in section 3. If it is still unclear, tick **Discuss**.
5. **Fill the answer sheet.** Copy your ticks into the table in section 9. One person fills it in for the group. Put your name and the date in each row you answered.
6. **Send it back** to the person who gave you this pack. Partial answers are fine. Rows left blank stay on the current default and are marked "not yet approved".
7. **What happens next.** Section 7 shows what each answer changes in the product. An answer never changes anything on its own. A developer makes the change, and the admin Feature switches page records who flipped what and why.

**Rule of thumb.** If you are unsure, pick the cautious option: more privacy, fewer messages, slower access. Cautious options are easier to relax later than to tighten.

---

## 3. Glossary

| Term | Plain meaning |
| --- | --- |
| Default | The value the build chose because nobody had decided yet. |
| Feature switch (flag) | An on/off button on the admin screen that turns a feature on or off without a new release. |
| Audit log | A list of what staff did and why. Entries cannot be edited or removed. |
| Step-up | Asking staff to prove who they are again (a fresh code) before a risky action. |
| MFA (two-step sign-in) | A password plus a second proof, such as a code from a phone app. |
| Session | The period you stay signed in on a device. |
| Idle | Time with no activity. |
| Grace period | Waiting time before something permanent happens, so the member can change their mind. |
| Erase / delete | Remove the data for good. |
| Anonymise | Keep the content but remove the name. It then shows as "Deleted member". |
| Tombstone | The empty account record left behind after erasure. It holds no personal data. Other content points at it. |
| Retention | How long we keep a kind of data before deleting it. |
| DPDP | India's Digital Personal Data Protection Act, 2023. The law the data rights work follows. |
| Consent | A member's recorded "yes" to a specific use of their data. Each one is saved with the version of the text they saw. |
| Quiet hours | A daily window when non-urgent messages are held back. |
| Critical notification | A message that must reach the member at any time, such as a security alert. |
| Reputation | A points score from community behaviour. It does not unlock any power today. |
| Moderator | A member with the power to remove forum posts. |
| OTP / email code | A 6-digit number sent by email to prove the address is real. |
| Processor | A company that handles data for us, such as the database host or the email sender. |
| Counsel | Your lawyer. |
| IST | Indian Standard Time. |
| Field policy | The rule table that decides which person may see which piece of data. |

---

## 4. The decisions

Each block shows what exists today, with the exact value and where it lives. Paths are relative to the repository root. Tick boxes are in each block and again in the answer sheet.

Tick format used below: ☐ Approve  ☐ Change to ______  ☐ Discuss

### 4.1 Member approval (DEC-035)

**PR-01. Approval rule for new members** (priority 1; unblocks TASK-022, TASK-049)

- **Today.** Every new account is created unapproved and unverified. No email goes out. An admin or super admin approves it; only then is the verification email sent. The feature switch `onboarding.instant_access` is **off**. When switched **on**, the 6-digit code is emailed at sign-up and a member who enters it is approved at once.
- **Where.** Switch registry: `apps/backend/src/modules/feature-flags/feature-flag.registry.ts`. Sign-up logic: `apps/backend/src/modules/identity/application/services/auth.service.ts`. Who may approve: permission `users:approve`, held by `admin` and `super_admin` (`apps/backend/prisma/seed.ts`).
- **Why.** The plan documents describe instant onboarding. The code shipped with approval. The build kept today's behaviour and added a switch so you can choose without a code change.
- **Options.**
  - **A. Keep approval.** Strongest control. New members wait. Admins review every sign-up. The wait time has never been measured.
  - **B. Instant access after email code (the built switch).** No wait. Anyone with a working email gets in. Abuse and fake accounts rise, and there is no "review later" queue yet.
  - **C. Verify first, limited access.** Verified members can read and complete their profile. Posting and uploads wait for approval. Best balance. **Not built** (small change; see Doc 06 s3).
- **Recommended.** Keep A for launch. Ask for the measured wait (Doc 03 s6.2 query). Build C before switching to B.
- **What changes.** Time to first value (first post, first quiz), admin hours per week, and spam risk.
- ☐ Approve (keep approval)  ☐ Change to ______  ☐ Discuss

**PR-06. Email code rules** (unblocks TASK-022)

- **Today.** 6 digits, valid 10 minutes, locks after 5 wrong tries for 15 minutes, a new code can be requested after 60 seconds, at most 5 codes per address per hour.
- **Where.** `packages/types/src/onboarding.ts`. The 5-try rule is from the requirement PRD-001. The 60 seconds and 5 per hour are defaults the build chose; the documents are silent.
- **Why.** Stops guessing and mail flooding without locking out honest members for long.
- **Options.** Longer lock (safer, more support requests) or shorter (easier, more guessing room).
- **Recommended.** Approve.
- ☐ Approve  ☐ Change to ______  ☐ Discuss

### 4.2 Consent, age and WhatsApp

**PR-02. Consent texts and versions at registration** (priority 2; unblocks TASK-025, TASK-054) **Needs a lawyer.**

- **Today.** Four consent purposes, each stored with a version number (all at version 1):

| Purpose | Required to register? | Can be withdrawn later? | Text shown today (summary) |
| --- | --- | --- | --- |
| Terms of Service | Yes | No (only by closing the account) | "You agree to use PacketPulse honestly, keep your sign-in private, and follow the community rules." |
| Privacy Policy | Yes | No (only by closing the account) | "PacketPulse stores your name, email and the content you choose to publish, uses them to run your account, and does not sell them." |
| Share my resume with PacketPulse reviewers | No | Yes | "The PacketPulse screening team may read the resume you upload. You can withdraw this at any time." |
| Share my profile with hiring companies | No | Yes | "PacketPulse may forward your profile to a company after a person on the team confirms it. You can withdraw this at any time." |

- **Where.** Fixed facts: `packages/types/src/consent.ts`. Version 1 texts: migration `apps/backend/prisma/migrations/20261121150000_consent_privacy/migration.sql`. Full-text pages: `/terms`, `/privacy`.
- **Why.** The data-protection law expects consent to be specific, recorded and withdrawable. Required consents gate the account. Optional ones are recorded now so they are honoured when resumes and recruiting launch.
- **Options.** (a) Keep the short summaries. (b) Have counsel write full texts, keep the summaries as a short form. (c) Merge the two optional consents into one (simpler, less specific).
- **Recommended.** (b).
- **Gap to know.** The Privacy page is still a placeholder (tracker TASK-054). The two optional consents say "not used yet" because resumes and recruiting do not exist.
- ☐ Approve  ☐ Change to ______  ☐ Discuss  Lawyer answered on: ______

**PR-03. When consent is asked again** (unblocks TASK-025) **Needs a lawyer.**

- **Today.** A super admin publishes a new version of a text and must give a reason of at least 10 characters. On the next visit every member is asked to accept the new version. Each grant and withdrawal is a new row in a history the member can see. The history is never edited.
- **Where.** `packages/types/src/consent.ts` (`PublishConsentPolicySchema`); permission `policies:manage` is held by **no role**: only the super admin passes.
- **Why.** Proof of what each member agreed to and when.
- **Options.** Ask again for every change (safest, more friction) or only for material changes (needs a rule for "material").
- **Recommended.** Keep "every change". Reconsider if wording fixes cause fatigue.
- ☐ Approve  ☐ Change to ______  ☐ Discuss

**PR-04. Minimum age 18** (priority 3, OPEN-20; unblocks TASK-022, TASK-023) **Needs a lawyer.**

- **Today.** Registration needs a tick: "I confirm that I am 18 years old or older." Onboarding asks for date of birth and rejects anyone under 18. The account stays but cannot finish onboarding.
- **Where.** `packages/types/src/onboarding.ts` (`MINIMUM_AGE = 18`); tick text in `apps/web/src/features/auth/components/RegisterForm.tsx`.
- **Why.** Processing a child's data needs a parent's verifiable consent under DPDP. An adult-only rule is the simplest safe default (Doc 1, OPEN-20).
- **Options.** Keep 18. Allow 16 or 17 with parent consent (needs a parent flow that does not exist). Ask only for the tick and not the date of birth (less data, weaker check).
- **Recommended.** Keep 18 and the date of birth. Counsel to confirm.
- ☐ Approve  ☐ Change to ______  ☐ Discuss

**PR-05. WhatsApp number and opt-in** (unblocks TASK-021, TASK-022; relates to OPEN-18)

- **Today.** The number is **optional** at sign-up. A 10-digit Indian mobile is assumed; other countries need the +country code. For notifications WhatsApp is **off by default** and needs an explicit opt-in plus a confirmed number. No WhatsApp provider is connected, so nothing is sent; attempts are logged as "skipped: no provider".
- **Where.** `packages/types/src/whatsapp.ts`, `packages/types/src/notifications.ts`.
- **Why.** The requirement PRD-006 says optional. PRD-003 lists it as required. The build followed PRD-006 and the plan's rule that WhatsApp is opt-in only. International numbers were allowed because the documents say "international later".
- **Options.** Optional (current). Required for job applicants only (matches recruiting need). Required for everyone (most friction, cheapest follow-up).
- **Recommended.** Keep optional. Require it only at the point of applying for a job.
- ☐ Approve  ☐ Change to ______  ☐ Discuss

### 4.3 Profile privacy

**PR-07. Profile privacy defaults** (priority 7, OPEN-19; unblocks TASK-025) **Partly legal.**

- **Today.** Four profile fields each have a setting, **private** by default: About me, Experience level, Social links, Certifications. A member can change each to **members** (visible to other signed-in members). There is **no public** level and no public web profile or search-engine listing.
- **Where.** `packages/types/src/consent.ts`; database defaults in the `consent_privacy` migration.
- **Why.** Privacy first. Members opt in later (OPEN-19).
- **Options.** All private (current). Default "members" for social links only (better networking, less privacy). Add a public level later.
- **Recommended.** Keep private by default.
- ☐ Approve  ☐ Change to ______  ☐ Discuss

**PR-08. Who sees what** (unblocks TASK-012, TASK-025)

| Data | Visible to |
| --- | --- |
| First name, last name, avatar | Every signed-in member (always) |
| Email address, WhatsApp number | Only the member and PacketPulse staff, always, whatever the settings |
| Date of birth | The member, admins and super admins. **Denied** to recruiters and companies. |
| About me, experience level, social links, certifications | The member and staff; other members only if the member chose "members" |
| Skills | Per skill: public, members or private. Default **members** (build default, docs silent). Up to 25 skills per member. |

- **Where.** `packages/types/src/consent.ts`, `docs/research/10-threat-model-and-data-map.md`. The skill default and limit come from the skill-taxonomy hand-over notes (defaults D1 and D2).
- **Why.** Matches the visibility principle DEC-015 (staff see the full profile, companies see allowed fields only after forwarding, date of birth is never shown to companies).
- **Open point.** Nobody has decided whether moderators (not admins) may see email and WhatsApp. Today they are not treated as staff for this. Confirm.
- **Recommended.** Approve. Skills default "members" could be "private" if you want the stricter line.
- ☐ Approve  ☐ Change to ______  ☐ Discuss

### 4.4 Community rules

**PR-10. Community guidelines text** (priority 6, OPEN-14; unblocks TASK-026, TASK-043)

- **Today.** Version 1 reads: be respectful; never post passwords, keys, customer data or confidential network configurations; no job spam; do not copy assessment answers; credit sources; no harassment, doxxing or discrimination. A member must accept it before their first post. An admin can publish a new version with a reason.
- **Where.** Text in migration `20261121190000_community_qa_guidelines_reputation/migration.sql`; code in `apps/backend/src/modules/forums/application/services/forum-guidelines.service.ts`.
- **Why.** From Doc 1 s10.4.
- **Options.** Keep the six rules. Add rules (for example on AI-generated answers, or on self-promotion by speakers and recruiters). Keep it short so people read it.
- **Recommended.** Approve the six rules. Decide whether to add a rule on AI-written answers.
- ☐ Approve  ☐ Change to ______  ☐ Discuss

**PR-11. The ladder of consequences, appeals and response times** (OPEN-14; unblocks TASK-043)

- **Today.** The guidelines text tells members: a moderator removes a post and gives the reason; then a warning; then a posting limit for 7 days; then 30 days; then suspension (two admins must agree). Reports are acknowledged within 24 hours, urgent ones (exposed credentials, harassment) within 4 hours. Appeals go to a different admin within 5 working days.
- **What is built.** Removal with a reason, the report queue (API only), the urgent flag and an audit entry. **Not built:** warnings, posting limits, two-admin suspension, appeals, any clock or reminder for the 24-hour and 4-hour targets, and the moderator queue screen (TASK-043).
- **Why it matters.** Members are asked to accept a text that promises steps that do not exist. That is a trust and legal risk.
- **Options.** (a) Keep the text and build the steps first. (b) Shorten the text to what exists and add steps as they are built. (c) Keep the text and run the steps by hand (a spreadsheet) until built.
- **Recommended.** (b) now. Move to the full text as each step ships.
- ☐ Approve  ☐ Change to ______  ☐ Discuss

**PR-12. Thread modes and posting requirements** (unblocks TASK-026)

- **Today.** Three modes: **Learning** (default), **Production issue**, **Expert design**. A title needs at least 8 characters. Details need at least 20. The author must tick that passwords, keys and customer data were removed. A thread can have one accepted answer, chosen by the asker or a moderator. The asker's own answer earns nothing.
- **Where.** `packages/types/src/forums.ts`; behaviour in `forum-threads.service.ts`.
- **Why.** Requirement PRD-024. The tracker text says "question and discussion"; the code has the three modes above. The code and the requirement agree; the tracker wording is stale.
- **Options.** Keep three modes. Reduce to Question and Discussion (simpler to understand). Add more.
- **Recommended.** Approve. Check the labels read clearly to a newcomer.
- ☐ Approve  ☐ Change to ______  ☐ Discuss

**PR-13. Reporting a post** (unblocks TASK-026, TASK-043)

- **Today.** Reasons: spam or advertising; off topic; harassment or discrimination; passwords, keys or customer data; copied assessment answers; something else. Harassment and exposed data count as **urgent**. A member can send at most **10 reports a day**. You cannot report your own post or report the same post twice. A moderator then dismisses or removes, always with a reason.
- **Where.** `packages/types/src/forums.ts` (`FORUM_REPORTS_PER_DAY = 10` is marked an open question there).
- **Why.** The six reasons and 24h/4h targets come from Doc 1 s10.4. The 10-a-day cap is a build default.
- **Options.** Lower cap (less abuse of reporting, may block real reports in a raid). Higher cap. No cap.
- **Recommended.** Approve 10.
- ☐ Approve  ☐ Change to ______  ☐ Discuss

**PR-14. Reason required when a moderator acts** (OPEN-14; unblocks TASK-015, TASK-043)

- **Today.** A moderator who removes, locks, pins, or accepts an answer on **someone else's** post must write a reason. The minimum is **5 characters** for forum actions and **10 characters** for admin actions such as deleting a user or changing a feature switch. The reason goes to the audit log, and the author is told the reason.
- **Where.** `packages/types/src/forums.ts` (`FORUM_REASON_MIN = 5`) and `packages/types/src/admin.ts` (`AUDIT_REASON_MIN_LENGTH = 10`).
- **Why.** Accountability. The two minimums are an inconsistency, not a decision.
- **Options.** Make both 10 (consistent, slightly slower). Keep 5 for forums (faster, weaker reasons).
- **Recommended.** Make both 10.
- ☐ Approve (make both 10)  ☐ Change to ______  ☐ Discuss

**PR-15. Reputation points** (unblocks TASK-026)

| Event | Points today | Limit |
| --- | --- | --- |
| Your answer is accepted | +15 | Own answer earns nothing. Taken back if the answer is removed or the choice changes. |
| Someone marks your reply helpful | +2 | Max **20 points a day** from helpful votes. One voter can give you at most **3 helpful votes in 30 days**. |
| A moderator removes your post | −10 | Applied once per removed post. |

- **Where.** `packages/types/src/forums.ts`; the code marks all of these as open questions: "defaults the community lead can change here."
- **Why.** Reward real help and make vote farming hard. The documents give no numbers.
- **Options.** Different weights, or switch reputation off at launch (Doc 1 says reputation unlocks nothing sensitive at launch).
- **Recommended.** Approve.
- ☐ Approve  ☐ Change to ______  ☐ Discuss

**PR-16. Reputation levels** (unblocks TASK-026)

- **Today.** Shown as text and a number: **New** (under 20), **Contributor** (20 or more), **Trusted** (100 or more), **Expert** (500 or more). The level has no powers.
- **Where.** `packages/types/src/forums.ts` (`reputationLevel`).
- **Why.** A build default. "Expert" is a strong word for a score; consider "Veteran" or no label.
- **Recommended.** Approve the thresholds. Rename "Expert" if you do not want it to imply verified skill.
- ☐ Approve  ☐ Change to ______  ☐ Discuss

### 4.5 Quizzes and certificates

**PR-17. Attempt limit** (priority 8, OPEN-05; unblocks TASK-032)

- **Today.** Each quiz allows **3 attempts in total**. A quiz author can change this from 1 to 100 or choose unlimited. Existing quizzes were set to 3 by the migration.
- **Where.** `packages/types/src/quizzes.ts` (`maxAttempts` default 3); migration `20261120185429_quiz_integrity`.
- **Why.** The plan recommends "3 per assessment in any 90 days" (Doc 1 s10.2). The build counts all attempts, not just those in 90 days, because a rolling window is more complex.
- **Options.** 3 in total (current). 3 per 90 days (plan). Unlimited for practice quizzes and limited only for certifying quizzes.
- **Recommended.** Keep 3 in total for now; move to 3 per 90 days when you launch verified labels.
- ☐ Approve  ☐ Change to ______  ☐ Discuss

**PR-18. Retake gap** (unblocks TASK-032)

- **Today.** **0 seconds**: a member can retake straight away, up to the attempt limit. The setting exists per quiz (up to a year).
- **Why it differs from the plan.** Doc 1 s10.2 recommends **7 days** after a failed attempt. The build default is zero so existing quizzes behave as before.
- **Options.** 0 (current, easy practice). 24 hours. 7 days (plan, discourages guessing).
- **Recommended.** 7 days for certifying quizzes; 0 for practice.
- ☐ Approve  ☐ Change to ______  ☐ Discuss

**PR-19. Time limits** (unblocks TASK-032)

- **Today.** The limit is set **per quiz** (in seconds) and is optional. When the quiz has one, the server fixes the end time at the moment the attempt starts. A submission up to **5 seconds** late is accepted (grace for slow networks). Later than that, the attempt is rejected, marked expired, and **still counts** as an attempt. Abandoned attempts expire lazily when the member next visits.
- **Where.** `packages/types/src/quizzes.ts`; `quiz-attempts.service.ts` (`SUBMIT_GRACE_MS = 5000`).
- **Why.** The plan says the limit is "set per assessment and shown before starting."
- **Options.** More grace (kinder). No grace (strict). Extra time on request for accessibility (the plan says an admin approves it; **not built**).
- **Recommended.** Approve. Decide how a member asks for extra time.
- ☐ Approve  ☐ Change to ______  ☐ Discuss

**PR-20. Pass mark** (unblocks TASK-032)

- **Today.** Default **70%**, set per quiz from 1% to 100%.
- **Why.** The plan says 70%, adjustable between 60% and 80%. The code allows a wider range.
- **Options.** Narrow the range to 60-80% (plan). Leave it open.
- **Recommended.** Narrow to 60-80% for certifying quizzes.
- ☐ Approve  ☐ Change to ______  ☐ Discuss

**PR-21. Quiz expiry and certificate validity** (unblocks TASK-032, TASK-034)

- **Today.** A quiz can have an end date, after which no new attempts start. Certificates have **no validity period**: they never expire. The plan recommends **24 months**, with a reminder 60 days before. Not built.
- **Options.** No expiry (simplest, a certificate can go stale). 24 months (plan). Different periods by level.
- **Recommended.** Decide now, because it changes what a certificate means to employers. Suggest 24 months.
- ☐ Approve (24 months)  ☐ Change to ______  ☐ Discuss

**PR-22. Certificates when a member deletes their account, and when a quiz is deleted** (unblocks TASK-032, TASK-046) **Needs a lawyer.**

- **Today.** Certificates are **kept**. The holder's name shows as "Deleted member". A quiz that issued certificates cannot be deleted: it is archived instead.
- **Why.** A certificate number must keep verifying for whoever relied on it.
- **Options.** Keep anonymised (current). Delete with the member (certificate stops verifying). Let the member choose.
- **Recommended.** Approve, and ask counsel.
- ☐ Approve  ☐ Change to ______  ☐ Discuss

*The plan also lists a result screen that hides correct answers, random question order, an honesty statement, and no proctoring. None of these were checked in code for this pack. See section 8.*

### 4.6 Notifications

**PR-23. Quiet hours** (priority 10, OPEN-04; unblocks TASK-021)

- **Today.** **21:00 to 08:00 IST.** Non-critical email is held and sent after 08:00. In-app notices are never held.
- **Where.** `packages/types/src/notifications.ts` (`NOTIFICATION_POLICY_DEFAULTS`); can be overridden by environment settings. Members can set their own quiet hours.
- **Why.** From Doc 1 s10.3. India Standard Time suits the main audience.
- **Options.** Keep. Shorter window (more reach). Per-member time zone (needs more work; members abroad get messages at night).
- **Recommended.** Approve.
- ☐ Approve  ☐ Change to ______  ☐ Discuss

**PR-24. Daily cap** (unblocks TASK-021)

- **Today.** At most **3 non-critical email and WhatsApp messages per member per day.** In-app notices are not counted. Critical messages are not counted.
- **Options.** 3 (current). 5. Offer a daily digest instead (member choice: off, daily, weekly).
- **Recommended.** Approve 3, with the digest option.
- ☐ Approve  ☐ Change to ______  ☐ Discuss

**PR-25. Which events are critical** (unblocks TASK-021)

- **Today.** Critical (always delivered, cannot be switched off): **security alerts**, **"your data export is ready"**, **"your account is being deleted"**. Conditionally critical, **built but not yet sent by any feature**: an interview starting within 24 hours; an offer expiring within 48 hours.
- **Where.** `packages/types/src/notifications.ts`.
- **Why.** Doc 1 s10.3. The two data-rights notices were added by the build.
- **Options.** Add "your post was removed" as critical (the member must be told promptly; today it follows normal rules and quiet hours).
- **Recommended.** Approve, and make "your post was removed" critical.
- ☐ Approve  ☐ Change to ______  ☐ Discuss

**PR-26. Default channels** (unblocks TASK-021; relates to OPEN-18)

- **Today.** In-app is on for every event. Email is **on** by default for: moderator removal, account approval, role changes, security, interviews, offers, assessment results, badge expiry, billing, data export, deletion. Email is **off** by default for: forum replies, accepted answers, blog comments, certificates issued. WhatsApp is off for all, allowed only for interviews and offers. Members change all of this at `/settings/notifications`.
- **Where.** `packages/types/src/notifications.ts`.
- **Options.** More email on (higher engagement, more noise). Fewer on (quieter).
- **Recommended.** Approve.
- ☐ Approve  ☐ Change to ______  ☐ Discuss

### 4.7 Sessions and sign-in

**PR-27. How long members stay signed in** (unblocks TASK-009)

- **Today.** A member is signed out after **30 days without activity** (43,200 minutes). A visible tab renews quietly about every 10 minutes.
- **Where.** `apps/backend/src/common/config/env.schema.ts` (`SESSION_MEMBER_IDLE_MINUTES`).
- **Why.** Doc 1 s10.9. Long sessions suit learners on personal devices.
- **Options.** Shorter (safer on shared computers). Longer.
- **Recommended.** Approve.
- ☐ Approve  ☐ Change to ______  ☐ Discuss

**PR-28. Staff sessions and login lockout** (unblocks TASK-009, TASK-013)

- **Today.** Admins and super admins are signed out after **30 minutes idle** and after **8 hours in total** whatever they do. Five wrong passwords on one account lock it for **15 minutes**.
- **Where.** `env.schema.ts` (`SESSION_STAFF_IDLE_MINUTES = 30`, `SESSION_STAFF_ABSOLUTE_MINUTES = 480`, `LOGIN_MAX_FAILURES = 5`, `LOGIN_LOCK_MINUTES = 15`).
- **Why.** Doc 1 s10.9. Staff can change and delete other people's data.
- **Trade-off.** The lockout can lock a real member out for 15 minutes. That is accepted.
- **Open point.** The old "session timeout" box on the admin Settings screen does nothing. It is still shown, with a "not active yet" note. Remove it or make it real.
- **Recommended.** Approve. Remove the unused box.
- ☐ Approve  ☐ Change to ______  ☐ Discuss

### 4.8 Data rights and retention

**PR-29. Data export** (unblocks TASK-046)

- **Today.** A member asks for an export on the Data rights page. A background job builds **one zip of JSON files plus a README**. The file is kept for **7 days**. Each download link works for **5 minutes** and a new one is made per click. Only the member can open it, and each open is logged. One open export per member. The feature switch `data_rights.export` is **on**.
- **Where.** `packages/types/src/data-rights.ts`; `docs/ops/data-retention.md`.
- **Why.** DPDP access right; the 7 days come from the Doc 3 screen spec.
- **Options.** 7 days (current). 3 days (less exposure). A readable PDF as well as JSON.
- **Recommended.** Approve.
- ☐ Approve  ☐ Change to ______  ☐ Discuss

**PR-30. Account deletion: 30-day grace** (unblocks TASK-046)

- **Today.** A member asks to delete, re-enters their **password**, and the account is erased after **30 days** unless they cancel. They can cancel any time until the erasure job starts. Sign-in works during the grace period. A final "your account was deleted" email is sent.
- **Why.** Doc 3 SCR-038 says 30 days. Re-entering the password stops a stolen session from deleting an account.
- **Options.** 30 days (current). 7 days (faster). Immediate (no regret time).
- **Recommended.** Approve.
- ☐ Approve  ☐ Change to ______  ☐ Discuss

**PR-31. What is erased, anonymised or kept** (priority 5; unblocks TASK-046) **Needs a lawyer.**

- **Today.** The account record is never removed: it becomes an empty **tombstone** named "Deleted member". Summary of the full table in `packages/types/src/data-rights.ts`:
  - **Deleted:** sign-in credential, sessions, name, email, phone, date of birth, bio, avatar, skills, notifications and preferences, uploaded private files and earlier exports, likes, quiz attempts that earned no certificate, forum threads nobody replied to, unpublished blog posts.
  - **Anonymised (content stays, name removed):** published blog posts and comments, resources, recordings, forum replies and threads others replied to, earned certificates, browser error logs.
  - **Kept:** consent history (3 years after erasure), the erasure request (3 years), reports the member made, reputation entries, the audit log, the private-file access log.
- **Why.** Others depend on shared content. Proof of consent and staff actions must survive. Records are append-only by design.
- **Open point.** Older audit rows may still name an email in their details text. Redacting needs a decision (PR-34).
- **Options.** Keep as built. Delete community content too (breaks other people's threads). Let the member choose per item.
- **Recommended.** Approve. Counsel to confirm the "kept" rows.
- ☐ Approve  ☐ Change to ______  ☐ Discuss  Lawyer answered on: ______

**PR-32. Retention periods** (priority 4, OPEN-06; unblocks TASK-046) **Needs a lawyer.**

| Data | Kept for | Source |
| --- | --- | --- |
| Sign-in sessions (device, IP) | 30 days after expiry | build default |
| Password-reset and email-code records | 7 days after expiry | build default |
| In-app notifications | 365 days | Doc 1 s10.7 (12 months) |
| Notification delivery log | 365 days | Doc 1 s10.7 |
| Browser error logs (IP, device) | 90 days | build default |
| Prepared data exports | 7 days | Doc 3 SCR-038 |
| Consent history after erasure | 3 years (1,095 days) | Doc 1 s10.7 |
| Finished export and erasure requests | 3 years | build default (same as consent) |
| Audit log | no automatic deletion; at least 3 years | Doc 1 s10.7 |
| Private-file access log | no automatic deletion | design (append-only) |
| Inactive accounts | not automated (see PR-33) | Doc 1 s10.7 |

- **Where.** `packages/types/src/data-rights.ts` (`RETENTION_RULES`); explained in `docs/ops/data-retention.md`. A job runs hourly and applies these.
- **Not covered here.** Invoices and payment records (tax law, commonly 6 to 8 years; the accountant confirms). Resume copies shared with companies (90 days after an application closes) and verification evidence (12 months after the decision). Those features do not exist yet.
- **Options.** Keep as built. Shorter periods (less data held, less proof). Longer periods (more proof, more risk).
- **Recommended.** Treat all as draft until counsel has answered.
- ☐ Approve  ☐ Change to ______  ☐ Discuss  Lawyer answered on: ______

**PR-33. Inactive accounts** (OPEN-06) **Needs a lawyer.**

- **Today.** Nothing is automated. The plan suggests a notice after 2 years of no use and erasure after 3.
- **Options.** Do it (needs a notice email and counsel). Never do it (more stored data, simpler). Notice only.
- **Recommended.** Decide with counsel before launch. Do not automate until a notice email exists.
- ☐ Approve (2-year notice, 3-year erasure)  ☐ Change to ______  ☐ Discuss

**PR-34. Redacting emails in old audit rows** **Needs a lawyer.**

- **Today.** Some older audit entries (user deleted, admin registered) may contain an email address in their details text. The audit log cannot be edited.
- **Options.** Leave (tamper-proof, keeps an email). Add a controlled redaction path (cleaner, weakens the "cannot be edited" promise).
- **Recommended.** Counsel decides.
- ☐ Approve (leave)  ☐ Change to ______  ☐ Discuss

### 4.9 Uploads and resumes

**PR-35. Private file rules** (unblocks TASK-014, TASK-024)

- **Today.** Maximum **5 MB** per file. Resumes: PDF, DOC, DOCX. Certificates and evidence: PDF, PNG, JPEG, WebP. A file is checked by type, size and signature. Downloads use **60-second** links. Only the owner, admins and super admins may open a file. Every open and every denied attempt is logged. The default scanner only checks file signatures. A real antivirus is **optional and not on**. No upload screen exists yet.
- **Where.** `packages/types/src/files.ts`; `docs/ops/` (private files).
- **Options.** 5 MB (current). 10 MB (scanned resumes). Require antivirus before launch.
- **Recommended.** Approve 5 MB. Make antivirus a launch requirement.
- ☐ Approve  ☐ Change to ______  ☐ Discuss

**PR-36. Resume use and retention** (unblocks TASK-024) **Needs a lawyer.**

- **Status when read.** Resume upload and parsing (TASK-024) is **not built**. No resume model exists. Only the private file pipeline and the optional "share my resume with reviewers" consent exist (PR-02).
- **Plan values to decide when it is built.** Company access ends 90 days after an application closes; evidence files deleted 12 months after the decision (Doc 1 s10.7). Whether AI may parse resumes is not decided.
- **Recommended.** Nothing to answer yet. Tick "Discuss" if you have a view on AI parsing.
- ☐ Approve  ☐ Change to ______  ☐ Discuss

### 4.10 Feature switches

**PR-37. Who may change a switch** (unblocks TASK-047)

- **Today.** Changing any switch needs the permission `admin:manage-settings`, held by **admin** and **super admin** (not moderators or instructors). The change needs a written reason of at least **10 characters**. It is saved in the database and written to the audit log.
- **Where.** `apps/backend/src/modules/feature-flags/feature-flag.registry.ts`; role table in `apps/backend/prisma/seed.ts`.
- **Options.** Any admin (current, fast). Super admin only for risky switches such as instant access and sign-up. Two people must agree for risky switches.
- **Recommended.** Super admin only for **Open sign-up** and **Instant access**; any admin for the rest.
- ☐ Approve  ☐ Change to ______  ☐ Discuss

**PR-38. The switches and their default positions** (unblocks TASK-047)

| Switch | Default | Plain meaning |
| --- | --- | --- |
| registration.open | **On** | Anyone can create an account |
| forums.posting | **On** | Members can start threads and reply |
| quizzes.attempts | **On** | Members can start quiz attempts |
| resources.uploads | **On** | Members can submit resources |
| files.uploads | **On** | File uploads allowed |
| blogs.comments | **On** | Members can comment on blogs |
| notifications.email | **On** | Notification emails sent (critical ones always go) |
| onboarding.instant_access | **Off** | Instant onboarding (PR-01) |
| data_rights.export | **On** | Members can request an export (deleting an account has no switch: it is always available) |

- **Note.** The switch for sign-up uses the older settings column, so the former "registration enabled" setting and this switch are one thing. The note on the Settings screen says other old settings are "saved but not active".
- **Recommended.** Approve. Consider turning **files.uploads** off until antivirus is on.
- ☐ Approve  ☐ Change to ______  ☐ Discuss

### 4.11 Admin security

**PR-39. Two-step sign-in and step-up for staff** (priority 9, OPEN-13; unblocks TASK-044, TASK-006)

- **Today.** **None.** Admins sign in with a password only. There is no step-up (a fresh code before risky actions). There is no break-glass route. Staff sessions are short (PR-28).
- **Plan.** Required for admins and super admins; optional for members; an authenticator app or passkey, never SMS (Doc 1 s10.9).
- **Why.** Staff can approve members, erase data and change switches. A stolen password is enough today.
- **Options.** Required for staff at launch (recommended). Required only for super admin. Optional for all.
- **Recommended.** Required for all staff before the public launch.
- ☐ Approve  ☐ Change to ______  ☐ Discuss

**PR-40. How admins are created** (OPEN-13; unblocks TASK-044)

- **Today.** A public sign-up endpoint accepts one shared secret code (`ADMIN_SECURE_CODE`, at least 16 characters) and creates an approved, verified admin. Each creation is written to the audit log. It is the largest single privilege risk (finding S-4).
- **Options.** Switch it off in production now and invite staff from a super admin account. Keep until the invitation flow exists.
- **Recommended.** Switch it off in production now.
- ☐ Approve  ☐ Change to ______  ☐ Discuss

**PR-41. Password rules** (OPEN-13; unblocks TASK-022)

- **Today.** At least **8** characters with an upper-case letter, a lower-case letter, a number and a special character. No breached-password check.
- **Where.** `packages/types/src/auth.ts`.
- **Plan.** At least **12** characters, checked against breached lists, **no** complexity rules, no forced rotation, passkeys offered. This is current official guidance (Doc 1 s10.9).
- **Options.** Keep today's rules (familiar). Move to the plan (stronger, simpler for members).
- **Recommended.** Move to the plan.
- ☐ Approve (move to plan)  ☐ Change to ______  ☐ Discuss

### 4.12 Everything else marked as an owner decision

**PR-42. Where data is held, and processor agreements** (OPEN-06 and PRD-045) **Needs a lawyer.**

- **Today (from configuration, not confirmed with the providers).** Database, logins and files at Supabase, host indicates **Tokyo**. Backend at Render, **Singapore**. Web app at Vercel, **Singapore**. The Redis and email providers are not confirmed. All appear to be outside India. Signed processing agreements with each are **not verified**.
- **Options.** Keep and sign agreements. Move the database to an Indian region (cost, effort, may not be needed). Ask counsel first.
- **Recommended.** Counsel confirms before launch. Sign agreements with every provider.
- ☐ Approve (keep)  ☐ Change to ______  ☐ Discuss

**PR-43. Primary colour and theme** (OPEN-01; unblocks TASK-018, UI roll-out)

- **Today.** The new forest-green "Signal Grove" theme exists and is the default (light first, dark available). The old indigo look remains on screens not yet moved.
- **Recommended.** Approve forest green as the primary colour.
- ☐ Approve  ☐ Change to ______  ☐ Discuss

**PR-44. Sender identity and WhatsApp provider** (OPEN-18; unblocks TASK-021)

- **Today.** No dedicated sending domain is set. No WhatsApp provider is chosen. Email authentication is not confirmed. A WhatsApp Business account takes time to approve, so start early.
- **Recommended.** Name an owner and pick a dedicated sending domain.
- ☐ Approve  ☐ Change to ______  ☐ Discuss

**PR-45. Decisions that are not yet built and not asked here** (for awareness; no answer needed now)

OPEN-07 placement fee and its legal review; OPEN-08 payment provider and GST; OPEN-09 prices; OPEN-10 company onboarding; OPEN-11 hiring manager role; OPEN-12 ClickUp and n8n scope; OPEN-16 analytics provider; OPEN-17 referral programs; OPEN-21 candidate protections; DEC-037 fate of Blogs, Resources, Recordings and Network Tools; DEC-045 Packet Lab scope. The careers features (TASK-035 to TASK-042) have no code yet, so there is nothing to approve. The placement fee (OPEN-07) is a legal matter first.

---

## 5. Owner inputs the tracker lists (not policy, but they wait on you)

| Item | Why it waits on you |
| --- | --- |
| TASK-004 backups | Needs access to the Supabase and Render projects and a place to store backups. The database is on a free plan with no automated backups, so this is the only protection. |
| Cloudflare Turnstile keys | Set the site and secret keys **together**. Only the secret locks everyone out. |
| Trusted proxy setting (`TRUST_PROXY`) | A wrong value shares one limit between everyone or lets callers fake an address. |
| Required checks in GitHub branch protection | A repository setting only the owner can change. |
| Private storage bucket in Supabase | Needed before uploads work. |
| Owner contacts in the incident and monitoring documents | Owners are placeholders today. |

---

## 6. Items that need a lawyer rather than a vote

Take these to counsel first. Record the answer, the lawyer's name and the date on the answer sheet.

| ID | Item | Question for counsel |
| --- | --- | --- |
| PR-32 | Retention periods | Are the periods in the table acceptable? Especially consent proof (3 years), the audit log (3 years or more, never purged), finished requests (3 years), error logs (90 days), sessions (30 days). |
| PR-33 | Inactive accounts | Is notice at 2 years and erasure at 3 years right for us? |
| PR-02, PR-03 | Consent wording and re-consent | Full wording for Terms and Privacy; whether each change needs fresh consent; whether the optional consents are specific enough. |
| PR-04 | Age rule | Is "18 or older" with a date-of-birth check enough under DPDP? |
| PR-42 | Data location and processor agreements | Is holding data in Tokyo and Singapore permitted for us, and what must each provider sign? |
| PR-31, PR-22, PR-34 | Erasure table, certificates after erasure, emails in old audit rows | Which "kept" rows are lawful, and may certificates keep verifying without a name? |
| PR-36 | Resume use | Sharing with reviewers and companies; whether automated parsing needs separate consent. |
| PR-10, PR-11 | Guidelines and sanctions | Is suspension on the platform's terms enforceable as written, and is the appeal wording safe? |
| PR-07 | Profile visibility | Does "members" visibility need its own consent wording? |
| (grievance contact) | The grievance officer line on the data rights page | The page needs a named contact; the tracker lists it as not done. |
| (invoices) | Tax record retention | The accountant confirms the period when payments exist. |

Your lawyer should also decide when the main DPDP duties apply. The planning documents use about 14 May 2027 (Doc 06). That date was **not verified** for this pack.

---

## 7. What changes in the product when you answer

| Decision | If you approve | If you change it | Task it unblocks |
| --- | --- | --- | --- |
| PR-01 approval rule | Stays as is. Closes the DEC-035 item. | A developer flips the switch from the admin Feature switches page, or builds the limited-access path (option C). | TASK-022, TASK-049 |
| PR-02, PR-03 consent texts | Final texts published as version 2. Members are asked to accept again. | New text for counsel to review. | TASK-025, TASK-054 |
| PR-04 age | No change. | Date-of-birth check and register tick change. | TASK-022, TASK-023 |
| PR-05 WhatsApp | No change. | Required-ness moves to the apply step. | TASK-021, TASK-023 |
| PR-06 email code rules | No change. | Values in one file. | TASK-022 |
| PR-07, PR-08 privacy | No change. | Defaults and field-policy entries change. | TASK-012, TASK-025 |
| PR-10 to PR-16 community | Guidelines v1 stays; reputation values stay. | Publish a new guidelines version; change point values in one file. | TASK-026, TASK-043 |
| PR-11 sanctions | Plan to build warnings, limits, two-admin suspension and appeals. | Text is shortened to match what exists. | TASK-043 |
| PR-14 reason length | Both set to 10. | Stay mixed. | TASK-015, TASK-043 |
| PR-17 to PR-22 quizzes | Defaults stay. | Retake gap and range changes; validity and expiry reminders are built. | TASK-032, TASK-034 |
| PR-23 to PR-26 notifications | Approved as OPEN-04 values. | Values change by setting or in one file. | TASK-021 |
| PR-27, PR-28 sessions | No change. | Environment settings; remove the dead admin setting. | TASK-009 |
| PR-29 to PR-34 data rights | Draft values become approved. | Edit the one data-rights file; the retention job follows. | TASK-046 |
| PR-35, PR-36 uploads | No change. | Antivirus on; upload screen and resume parsing built later. | TASK-014, TASK-024 |
| PR-37, PR-38 switches | No change. | Permission per switch changes. | TASK-047 |
| PR-39, PR-40 admin security | Second factor and invitation flow get built. Shared code switched off. | Staff stay on password-only; risk stays. | TASK-044, TASK-009, TASK-006 |
| PR-41 passwords | Stronger rules, breach check. | Current rules stay. | TASK-022 |
| PR-42 data location | Agreements are signed. | Possible data move. | TASK-046, TASK-049 |
| PR-43 colour | Approved palette stays. | Re-skin of tokens. | TASK-018 |
| PR-44 sender identity | Domain and provider chosen. | Email and WhatsApp stay off. | TASK-021 |

---

## 8. What could not be verified

Everything quoted above was read in the repository (code, migrations, constants, tracker and ops documents) or in the plan documents in the Downloads folder (Document 1 sections 10.2 to 10.9). The following was **not** verified.

- **How long members wait for approval today.** Never measured. Doc 03 s6.2 has the query. It needs production access.
- **How many members exist.** The tracker says 109 users in the Supabase project the backend points at. Doc 06 mentions about 2,000 members. They cannot both describe production.
- **What production actually has set.** Whether production uses the defaults for session limits, quiet hours, the daily cap and the feature switches. All values here are code defaults, which environment settings can override.
- **The full text of the Terms and Privacy pages.** The Privacy page is a placeholder per the tracker. Only the one-sentence summaries are in the database migration. A super admin may already have published newer versions in production.
- **The guidelines version in production.** Version 1 is in the migration. A later version may exist.
- **Quiz features the plan lists that were not checked in code:** hidden correct answers, random order from a pool, the honesty statement, accessibility extra time. Time-extension support was not found.
- **Whether the 24-hour and 4-hour report targets are tracked anywhere.** None found in code; treated as not built.
- **Whether moderators can see members' email and WhatsApp.** The field-policy file was not read line by line for this.
- **Real email and WhatsApp delivery.** No provider was exercised. The tracker says a real email test is still to do.
- **Whether the migrations are applied to the live database.** The tracker lists several as pending.
- **Whether signed processor agreements exist.** Documents say "not verified".
- **The DPDP date of 14 May 2027** is taken from Doc 06 and was not checked against a legal source.
- **Whether the web screens show these exact values.** Values were read from the shared constants and backend code, not from a running site. Nothing was run.
- **Who the "community lead", "product lead" and "owner" are.** The plan documents name roles, not people.

---

## 9. Answer sheet

One person fills this in and sends it back. Copy the table into a spreadsheet or reply with the filled rows. Answer with **Approve**, **Change to: ...** or **Discuss**. Leave blank if not answered. A lawyer item needs the lawyer's name in the Name column.

| Decision ID | Decision | Answer | Name | Date |
| --- | --- | --- | --- | --- |
| PR-01 | New members: keep admin approval (DEC-035) | | | |
| PR-02 | Consent texts and versions | | | |
| PR-03 | Ask consent again on every change | | | |
| PR-04 | Minimum age 18 | | | |
| PR-05 | WhatsApp optional at sign-up, opt-in for messages | | | |
| PR-06 | Email code rules (10 min, 5 tries, 15 min lock, 60 s, 5 per hour) | | | |
| PR-07 | Profile fields private by default | | | |
| PR-08 | Who sees what (name and avatar to members; email, WhatsApp, date of birth restricted) | | | |
| PR-10 | Guidelines text (six rules) | | | |
| PR-11 | Ladder of consequences, appeals and response times in the text | | | |
| PR-12 | Three thread modes and posting minimums | | | |
| PR-13 | Report reasons, urgent types, 10 reports a day | | | |
| PR-14 | Reason length for moderators (both 10) | | | |
| PR-15 | Reputation points (+15, +2, −10; caps 20 a day and 3 per voter in 30 days) | | | |
| PR-16 | Reputation levels (20, 100, 500) | | | |
| PR-17 | Quiz attempts: 3 in total | | | |
| PR-18 | Retake gap (0 today; plan 7 days) | | | |
| PR-19 | Time limits and 5-second grace | | | |
| PR-20 | Pass mark 70% and its range | | | |
| PR-21 | Certificate validity (none today; plan 24 months) | | | |
| PR-22 | Certificates kept after erasure; quiz with certificates archived | | | |
| PR-23 | Quiet hours 21:00 to 08:00 IST | | | |
| PR-24 | Daily cap of 3 non-critical messages | | | |
| PR-25 | Critical events list | | | |
| PR-26 | Default channels per event | | | |
| PR-27 | Members signed out after 30 days idle | | | |
| PR-28 | Staff 30 minutes idle, 8 hours total; lockout 5 tries, 15 minutes | | | |
| PR-29 | Data export (7 days, 5-minute links) | | | |
| PR-30 | Deletion grace of 30 days | | | |
| PR-31 | Erase, anonymise, keep table | | | |
| PR-32 | Retention periods | | | |
| PR-33 | Inactive accounts (2-year notice, 3-year erasure) | | | |
| PR-34 | Emails in old audit rows | | | |
| PR-35 | File rules (5 MB, types, antivirus) | | | |
| PR-36 | Resume use and retention | | | |
| PR-37 | Who may change a feature switch | | | |
| PR-38 | Default position of each switch | | | |
| PR-39 | Two-step sign-in and step-up for staff | | | |
| PR-40 | Retire the shared admin sign-up code | | | |
| PR-41 | Password rules (move to 12 characters, no complexity rules) | | | |
| PR-42 | Data location and processor agreements | | | |
| PR-43 | Forest green as primary colour | | | |
| PR-44 | Sender domain and WhatsApp provider | | | |

PR-09 is not used. PR-45 is a list for awareness and has no row.

Sent by: ____________________  Date: ____________  Lawyer consulted (name, date): ____________________

---

*Nothing in this document is legal advice. Every retention period, consent wording and age rule above is a suggestion that needs a lawyer's review before it is treated as final.*
