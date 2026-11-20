# Incident process

Document 4 TASK-005 (OPS-03). This is a **draft for the owner to adopt**. Every `TO FILL` cell and `[OWNER: ...]` marker is a placeholder: no person has been named yet and none should be assumed. The owner fills in the **contact sheet** below once; the alert routes in [monitoring.md](monitoring.md) send to the same people.

## Contact sheet (owner fills in)

| Role | Primary: name | Primary: phone and email | Backup: name | Backup: phone and email | Does |
|---|---|---|---|---|---|
| Incident lead | `TO FILL` | `TO FILL` | `TO FILL` | `TO FILL` | Decides severity, owns the incident until closed, decides when to tell members. |
| Technical responder | `TO FILL` | `TO FILL` | `TO FILL` | `TO FILL` | Investigates, contains, fixes, restores. |
| Communications | `TO FILL` (may be the incident lead) | `TO FILL` | `TO FILL` | `TO FILL` | Writes and sends member notices and public status messages. |
| Legal / privacy counsel | `TO FILL` | `TO FILL` | | | Confirms whether a personal data breach notice is required, its timing and wording. |

| Other contacts | Where to find it | Filled in? |
|---|---|---|
| Member support address (used in the notice templates) | `TO FILL` | |
| Public channel for status updates (status page, social, WhatsApp/Telegram group) | `TO FILL` | |
| Provider consoles and who holds the logins: Supabase, Render, Vercel, Resend, GitHub | Password manager entry names `TO FILL` | |
| Backup passphrase (without it backups are unreadable) | Password manager entry `TO FILL` | |

One person may hold several roles while the team is small, but the incident lead must always be named before an incident starts. **An incident process with empty cells is not ready: fill the table before launch.**

## Severity levels

| Level | Meaning | Examples | Response target | Who is told |
|---|---|---|---|---|
| SEV1 | Personal data exposed or possibly exposed, security compromise, or site fully down for members | Leaked database or secret, account takeover, admin account misused, data deleted | Start immediately, any hour. Incident lead within 1 hour. | Incident lead, technical responder, counsel at once. Members as decided (see below). |
| SEV2 | Major feature broken or data wrong, no evidence of data exposure | Login fails, emails not sent, wrong permissions, backups failing | Same day | Incident lead, technical responder. Members if it lasts more than a few hours. |
| SEV3 | Minor degradation, workaround exists | One page broken, slow responses, a single failed job | Next working day | Technical responder. |

If unsure, pick the higher level; lower it later.

## Steps

1. **Detect and record.** Alert, member report or discovery. Open a new incident note (date, who found it, what was seen, links to logs). Keep a timestamped log of every action from here on.
2. **Assess.** Incident lead sets the severity. Question to answer first: *could personal data have been exposed, changed or lost?* If yes, SEV1.
3. **Contain.** Stop the damage before fixing the cause. Typical moves: rotate the affected secret (JWT secrets invalidate all sessions; see `docs/ops/environments.md`), disable the affected account or feature, turn on maintenance mode, revoke a leaked key at the provider (Supabase, Render, Vercel, Resend, GitHub).
4. **Preserve evidence.** Save logs and database state relevant to the incident before they roll off (Render keeps logs only briefly on the free tier; copy them out).
5. **Fix and recover.** Fix the cause, restore data from backup if needed (procedure and drill log in [backups.md](backups.md); the scripts are proven only against the local database until the first drill with a real production dump), verify with `/api/health` and a manual login.
6. **Notify.** See below.
7. **Review.** Within 5 working days write a short post-incident review: timeline, root cause, what worked, what did not, actions with owners. Update the threat model (`docs/research/10-threat-model-and-data-map.md`) and the tests if a gap was found.

## Who decides what

- **Severity:** incident lead.
- **Taking the site down or into maintenance:** incident lead (technical responder may do it alone in SEV1 if the lead cannot be reached within 15 minutes, and tells the lead afterwards).
- **Telling members:** incident lead, with counsel for anything involving personal data.
- **Telling the regulator:** counsel decides, owner signs off. Nobody else contacts a regulator.

## Informing members

Channels, in order: email to affected members (the platform sends through Resend), a banner on the website, and the public status page or social channel `[OWNER: which channels do you actually use?]`. Members hear from a named sender, in plain language, without blame or jargon, and are told what to do (for example, change password). Do not speculate about cause; say what is known, what is not, and when the next update will be.

### Template: member notice (service incident, no data exposure)

> **Subject:** PacketPulse: [short description] on [date]
>
> Hello [first name],
>
> Between [start time IST] and [end time IST] on [date], [what members could not do, e.g. sign in]. [One line on the cause if known.]
>
> Your account and data were not affected. [or: What was affected: ...]
>
> What we did: [fix]. What you need to do: [nothing / sign in again].
>
> We are sorry for the trouble. Questions: [support contact `[OWNER]`].
>
> [Name, role], PacketPulse

### Template: personal data breach notification (to affected members)

> **Subject:** Important: a security incident affecting your PacketPulse account
>
> Hello [first name],
>
> On [date] we discovered that [plain description: what happened]. This affected [which data: e.g. name, email address, hashed passwords] of [number or group] members, including you. It did not affect [data that was not involved].
>
> What this could mean for you: [likely consequences, honestly stated].
>
> What we have done: [containment and fixes]. What we recommend you do: [change password here and anywhere you reused it; be careful with emails claiming to be from us; ...].
>
> Contact: [`[OWNER: privacy contact name and email]`]. We will send another update by [date].
>
> We apologise. [Name, role], PacketPulse

### Regulator and legal duty (DPDP)

PacketPulse processes personal data of people in India, so the Digital Personal Data Protection Act, 2023 and its Rules apply. As understood today, a personal data breach must be reported to the Data Protection Board of India and to each affected person. The Rules set a short initial deadline and a more detailed report afterwards. **Counsel must confirm the current applicability, the exact deadlines (the drafts discussed 72 hours for the detailed report), the required content and the form of the notice before the first real incident, and this document must be updated with the answer.** Until then: treat the clock as running from the moment the incident lead is aware of a possible breach, and involve counsel in the first hour of any SEV1.

`[OWNER: counsel contact and confirmed deadlines]`

## Drill

Run a table-top exercise once before launch (for example "an admin's laptop with an open session is stolen") to check that the contacts above answer and the templates are usable. Record the date here: `[OWNER: date of first drill]`.
