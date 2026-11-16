# 07. Solo-Developer Plan and Community Discussion Brief

Part of the [research pack](00-index.md). Two parts: **Part A** re-plans [Doc 06](06-completing-2.0-pending-work-analysis.md) for one person doing everything; **Part B** is a ready-to-use kit for discussing it with community members (what to ask, what to decide yourself, and copy you can paste).

---

# Part A. The solo-developer plan

## A1. What changes when one person does it all

Doc 06's whole-plan figure (about 82 working weeks) assumed a full-time developer. A sole developer also carries support, moderation, community, hosting, legal follow-ups and the rest of life. So the plan has to be smaller, safer and more visible, not just slower.

| Principle | What it means in practice |
| --- | --- |
| Ship a visible change about every 4 to 6 weeks | Keeps the community engaged and gives real feedback; a silent 12-month build loses both |
| Tests before fixes, small changes, feature flags | One person cannot manually re-check 102 endpoints; the safety net must be automatic |
| Build only what the next release needs | No speculative modules; Careers waits until the earlier loop is working |
| Use the community for work only they can do | Reviewing technical content, testing, early users, mentoring, introductions to employers (Part B) |
| Protect time | Decide a fixed number of development days per week and publish it; the plan below shows both 3.5 and 5 |
| Document decisions in the repo | You are the single point of failure; the docs in `docs/research` are the handover |

## A2. The "Solo Core 2.0" scope

This is the part of 2.0 that one person can finish within roughly a year, in the order that protects members and the legal deadline first. It uses the sizes from Doc 06 (S=3, M=7.5, L=15 working days, including tests) with deliberately lean cuts.

| Step | What you ship | Dev days | Main tasks | Why in this order |
| --- | --- | --- | --- | --- |
| S1 Stabilise (lean) | Defect fixes with tests; quick wins; safe deletion; quiz integrity; staff invitations; a route-by-role test matrix; restore drill; alerts | 37.5 | 057 to 061, 004, 005, 006, 008, 013, 015, plus the Doc 06 quick wins | Protects 2,000 existing members and the proof model; prerequisite for everything |
| S2 Identity v2 and trust | New registration and onboarding, consent centre, data export and erasure, privacy notice, guidelines and fees pages, protected sensitive fields | 37 | 012, 022, 023, 025, 046, 054 | The data-protection duties start about 14 May 2027 (counsel to confirm); this step finishes before it |
| S3 Prove-lite | Skill taxonomy, quizzes tied to skills, private evidence uploads, admin review, badges with expiry, public criteria page | 45 | 014, 027, 032, 033, 034 | The product's differentiator; builds on the quizzes and certificates that already exist |
| S4 Practice | Packet Lab scenarios E1 to E3 (ping, ping across a router, open a web page A to Z) | 22.5 | Doc 05 phases 0 and 1 | Delivers the missing Practice module without a lab runtime; very visible and shareable |
| S5 Design and accessibility slice | Design tokens, accessible dialog, error and loading pages, skip link, reduced motion, a screen-reader pass on the key flows; the full Signal Grove re-skin is deferred | 17 | 018 (tokens), 020, 050 | Cheap, removes the largest accessibility risks; do the dialog and error pages early inside S1 |
| S6 Community upgrades | Question modes, accepted answers, reports, moderation queue | 11 | 026, 043 (reduced) | Raises answer quality; lowest dependency |
| **Total** | | **170** | | |

**Deferred (not abandoned):** the full visual re-skin, Hindi, AI drafting, ClickUp and n8n integrations, deeper analytics, mentoring, the careers platform, payments, interviews and offers. See A5 for Careers.

## A3. Calendar (start Monday 23 Nov 2026)

Steps are shown in sequence; in practice S5 and S6 items are interleaved. Pick the row that matches how many development days a week you can truly give.

| Step | At 3.5 dev days per week | At 5 dev days per week |
| --- | --- | --- |
| S1 Stabilise | 23 Nov 2026 to 6 Feb 2027 | to 14 Jan 2027 |
| S2 Identity and trust | to 21 Apr 2027 | to 6 Mar 2027 |
| S3 Prove-lite | to 20 Jul 2027 | to 8 May 2027 |
| S4 Packet Lab E1 to E3 | to 3 Sep 2027 | to 8 Jun 2027 |
| S5 Design slice | to 7 Oct 2027 | to 1 Jul 2027 |
| S6 Community upgrades | to 29 Oct 2027 | to 16 Jul 2027 |

Reading it:

- **The legal date is met** in both rows: consent, export and erasure are done by April or March, before about 14 May 2027.
- **The estimate is uncertain**: assume plus or minus 40%. Re-plan after S1 once you know your real pace (Doc 06 section 2.1).
- **AI assistance helps but does not remove the work**: it speeds writing code and tests; review, decisions, testing on a real device, support and legal steps remain yours. Do not shorten the dates until S1 shows the real pace.
- **What a faster pace buys**: at 5 days a week Packet Lab is public by early June 2027, which is a good community moment.

## A4. Visible wins along the way

| When (3.5 d/wk row) | Visible to members |
| --- | --- |
| Dec 2026 | Quick wins: clearer registration and approval messaging, proper error pages, certificate page fix, fake "Network Snapshot" removed |
| Jan to Feb 2027 | Safer accounts and quizzes (limits, no lost certificates); you can tell the community what was fixed |
| Mar to Apr 2027 | New sign-up, "my data" page (download or delete), privacy notice, guidelines and fees pages |
| May to Jul 2027 | Skill badges with dates and expiry; public "How verification works" |
| Aug to Sep 2027 | Packet Lab: watch a web page load, packet by packet |
| Oct 2027 | Better questions and answers in the forum |

## A5. Careers (jobs and the placement fee) as a solo developer

Careers was 21 weeks of full-time work in Doc 06 and carries the legal risk. For one person, I would not build it as a platform at first.

| Stage | What | Effort | Gate |
| --- | --- | --- | --- |
| Pilot by hand | A simple "opportunities" page or message group; a person (you or an admin) forwards verified profiles to one or two friendly employers by email; candidates consent each time; no fee charged | Almost no code | Needs DEC-035, consent in S2, and the profile and badges from S2 and S3 |
| Learn from the pilot | Which fields recruiters actually need; whether candidates accept a fee | Interviews (Part B) | Counsel review of the placement fee has finished |
| Build the smallest product | Company onboarding, positions, apply with consent, forwarding by an admin, status messages | About 8 to 10 weeks | Pilot shows demand |
| Payments and invoices | Only after the pilot proves a paying placement | About 3 weeks | OPEN-07, OPEN-08 decided |

This turns the biggest unknown into evidence before spending months of build time.

## A6. Working rules that keep a solo project alive

1. **One branch per task, tests first for anything touching permissions, money, consent or files.** Ask a trusted volunteer to review those pull requests when possible (Part B, roles).
2. **Feature flags for every new screen**, switched on first for you, then a small group, then everyone. Rollback is switching a flag off.
3. **A weekly 30-minute log** in the repo: what shipped, what you learned, what you decided. It is your handover and your announcement text.
4. **A written release checklist** (Doc 4 section 10) and a restore drill before the first production release.
5. **Do not let support and moderation consume development time silently.** Track the hours; if they exceed a day a week, recruit moderators from the community (Part B).
6. **Name a backup person** with access to hosting, the database and the domain, even if they never touch code (key-person risk).
7. **Take the first month's real pace** and re-plan; do not hold yourself to the dates above.

## A7. Decisions for you alone (not for a community vote)

| Area | Why not a vote |
| --- | --- |
| Security fixes, MFA, deletion rules | Safety must not depend on popularity |
| Data protection, retention, consent wording | Legal duties; counsel decides |
| The placement-fee rules | Legal and ethical; the community can give input but counsel and you decide (Doc 1 s10.5) |
| Hosting, payments provider, architecture | Technical; consult an engineer, not a poll |
| Approving content and verification outcomes | A named person decides, never a vote (DEC-012, DEC-019) |

---

# Part B. Discussing it with community members

## B1. Goals of the conversation

| Goal | Output |
| --- | --- |
| Check priorities with real members | A ranked list of what to build first |
| Find out what hurts today | Evidence for DEC-035 (approval wait), registration length, missing features |
| Test the big ideas | Do members want verified skills, practice scenarios, job matching, and would they accept a placement fee |
| Recruit helpers | Reviewers, testers, moderators, mentors, employer contacts |
| Build trust | Show a clear plan, honest limits and visible progress |

## B2. What to decide with the community and what to bring them as information

| Topic | Approach |
| --- | --- |
| Which features matter most | Poll and short conversations (B4) |
| First Packet Lab topics (DNS, TCP, HTTP, DHCP, and so on) | Poll |
| Language preference (English and Hindi) | Poll |
| Whether to charge candidates a placement fee | Ask carefully, listen, but do not promise; see B6 |
| Approval wait, data handling, security | Inform, do not vote |
| Volunteer roles | Invite |

## B3. How to run it (about two weeks, low effort)

| Step | Day | What | Time |
| --- | --- | --- | --- |
| 1 | 1 | Post the short announcement (B5) in the community group or forum and pin it | 20 min |
| 2 | 1 to 7 | Collect poll answers (B4) and invite replies | passive |
| 3 | 3 to 10 | Hold two 45-minute open calls (one weekday evening, one weekend) using the one-page brief (B7) | 2 hours |
| 4 | 5 to 12 | 8 to 10 short member interviews and 3 to 5 recruiter conversations using the guides in Doc 03 section 6.3 | about 8 hours |
| 5 | 12 to 14 | Summarise results, publish "what we heard and what we will do" | 2 hours |

Before the calls, run the approval-wait query in Doc 03 section 6.2 so you can share a real number (for example, "the median wait was X days"), which makes the discussion concrete.

## B4. The poll (8 questions, about 4 minutes)

Use any form tool the community already trusts. Do not collect names or numbers unless people volunteer; an anonymous poll is enough.

| # | Question | Options |
| --- | --- | --- |
| 1 | What best describes you? | Student or fresher; Working engineer (under 5 years); Working engineer (5 or more years); Trainer or mentor; Recruiter or hiring manager; Other |
| 2 | What do you mainly want from PacketPulse? (pick up to 2) | Learn; Practise hands-on; Prove my skills; Get a job; Get help with problems; Help others |
| 3 | Which would you use first? (rank) | Verified skill badges; Packet and protocol simulations; Better Q&A; Job opportunities |
| 4 | How was signing up? | Easy; OK; Confusing; Waiting for approval was a problem; I did not finish |
| 5 | If you waited for approval, how long did it feel? | Under a day; 1 to 3 days; About a week; More than a week; I did not wait |
| 6 | Which protocols or topics should the simulations cover first? (pick 3) | Ping and ARP; DNS; TCP handshake; HTTP and web; DHCP; Routing and NAT; TLS; IPv6; Troubleshooting faults |
| 7 | Would you be comfortable with each of these? | PacketPulse forwarding my verified profile to an employer, only when I say yes: Yes / Maybe / No. A fee paid only after I join, as a percentage of my first year's pay: Yes / Maybe / No |
| 8 | Would you help? (optional, leave a contact only if you agree) | Review technical content; Test new features; Moderate the forum; Mentor members; Introduce an employer; No thanks |

Question 7 is the sensitive one. Explain it in plain words, say nothing is decided, and say the final rules will follow legal advice.

## B5. Copy you can paste

### Short announcement (community group or forum)

> **PacketPulse: where we are and what's next**
>
> Hi everyone. PacketPulse started as a place to learn and share. We now want it to also help you **practise, prove your skills and find work**, in a way you can trust. I'm building this myself, so I want to do it in small, honest steps, and I need your help to pick the right ones.
>
> **What's coming, in order**
> 1. Safer accounts and fewer sign-up headaches
> 2. A "my data" page: download or delete your data, clear privacy rules
> 3. Skill badges that show who checked them and when
> 4. A visual **Packet Lab**: watch a web page load, packet by packet
> 5. Better questions and answers
> 6. Later: jobs, only with your consent and clear rules
>
> **Please spend 4 minutes on this poll: [link]**
> Or join an open call on [dates and times]. Tell me what is working, what is annoying and what you want first.
> If you can help (reviewing technical content, testing, moderating, or knowing employers), say so in the poll.

### Open call agenda (45 minutes)

1. Five minutes: where PacketPulse is today and what is being fixed
2. Ten minutes: the plan in order, and why
3. Ten minutes: a sketch of the Packet Lab (screenshots from Doc 05)
4. Fifteen minutes: questions and discussion
5. Five minutes: how to volunteer and what happens next

### Volunteer call

> **Help shape PacketPulse.** I'm looking for a few members to: (1) **review technical content** such as protocol scenarios and quiz questions (about 1 to 2 hours a month), (2) **test new features** before everyone else, (3) **help moderate** the forum, (4) **mentor** newer members, and (5) **introduce employers** who hire network, security or cloud engineers. Reply or fill the form and say which one.

### After the discussion: "what we heard"

> **What we heard.** Top three wishes: [from the poll]. The biggest pain: [for example, sign-up wait]. What we will do first: [steps]. What we will not do yet: [items]. Next update: [date].

## B6. Frequently asked questions (honest answers)

| Question | Answer |
| --- | --- |
| Is my data safe? | The system is being hardened and a full privacy notice and data controls are the second step; until then the current privacy page is short. Your data is never sold |
| Why did my approval take so long? | New accounts were approved by hand. The plan is to let you verify your email at once and finish your profile while approval happens (decision pending) |
| Will there be a fee to get a job? | Not decided. Any fee would only apply after you join a company, be shown clearly before you apply, and follow legal advice. Nothing will be charged without your clear consent |
| Will you use AI to decide about me? | No. AI may help draft content; people make every decision about verification and hiring |
| When will Packet Lab be ready? | Planned for the middle of 2027; a first version of the web-page walkthrough comes first |
| Can I help? | Yes: review content, test, moderate, mentor, introduce employers |

## B7. One-page brief for open calls

1. **Where we are**: community, resources, recordings, forums, quizzes with certificates, an admin team. About 2,000 members.
2. **What is missing**: a clear way to prove skills, hands-on practice, trustworthy privacy controls, and a fair path to jobs.
3. **The plan**: fix and secure first; then your data controls; then verified skills; then Packet Lab; then better Q&A; jobs later and carefully.
4. **How we work**: small releases every few weeks, tested first, with a public log of changes.
5. **How you can help**: the poll, the calls, and the volunteer roles.

## B8. Volunteer roles and what each needs

| Role | Does | Needs | Time |
| --- | --- | --- | --- |
| Content reviewer | Checks protocol scenarios and quiz questions against the RFCs; signs off in the repo | Networking knowledge; a short checklist (Doc 05 section 7.3) | 1 to 2 hours a month |
| Early tester | Tries new features on a phone and desktop; reports issues | A test link; a short form | 30 to 60 minutes per release |
| Moderator | Handles reports within the stated times (Doc 1 s10.4) | The guidelines and a clear escalation route | A few hours a week |
| Mentor | Answers questions and welcomes new members | Posting access; guidelines | Flexible |
| Employer contact | Introduces hiring managers for the pilot | A personal introduction | One or two conversations |
| Code reviewer (if any engineer volunteers) | Reviews pull requests touching permissions, money, consent, files | Repository access with limited rights | 1 to 2 hours per review |

Give volunteers only the access they need, and never share production data with them.

## B9. Privacy and consent cautions for the outreach itself

| Caution | Why |
| --- | --- |
| Do not message members' WhatsApp numbers for research unless they agreed to that purpose | The numbers were collected at sign-up and the privacy page does not state this use (Doc 02, PRD-010 gap). Post in groups, the forum or an announcement email that members chose to receive |
| Keep the poll anonymous; collect a contact only from volunteers | Data minimisation |
| Do not put member names, emails or data in documents or chats with AI tools | Doc 4 section 3 rule |
| Do not show other members' certificates or posts as examples without their permission | Consent |
| State clearly that nothing about fees or jobs is final | Avoids a promise you cannot keep |

## B10. What to bring back to this plan

| Result | Updates |
| --- | --- |
| Approval-wait number and signup feedback | DEC-035 (Doc 06 section 3.2) and the S1 and S2 order |
| Ranked features | The order of S3 to S6 and Packet Lab topic list |
| Fee comfort levels | Input only for the counsel review (OPEN-07); not a decision |
| Volunteers | Reviewer names on scenarios; moderator coverage; the employer pilot |
| New pain points | The backlog in Doc 03 section 8 |

## B11. Not verified

How large or active the community is outside the platform; which channels it uses (this kit assumes a group chat or forum); whether members have already agreed to be contacted for research; real approval waits; and how members will react to any mention of a fee.
