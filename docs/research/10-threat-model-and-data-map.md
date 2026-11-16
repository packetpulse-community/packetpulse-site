# 10. Threat Model and Data Map (SEC-13, part of TASK-002)

Part of the [research pack](00-index.md). Document 4 requires "a one-page threat model and a data map (what personal data, where, why, who can see it)" before Release 1 (SEC-13). This is the first draft, built from the code at the head of `feat/2.0-stabilise` and the findings in [Doc 04](04-existing-project-deep-analysis.md). Status: **draft for review**; it needs a second person and the owner's approval before TASK-002 can be closed.

## 1. System and trust boundaries

```
Browser ─▶ Vercel (Next.js, region sin1) ─▶ Render (NestJS backend, Singapore) ─▶ PostgreSQL (Supabase)
                                              │                                  ├─ Supabase Auth (credentials, in production)
                                              │                                  └─ Supabase Storage (files)
                                              ├─▶ Redis (queues, presence)       ▲
                                              └─▶ Email provider (Resend or SMTP)│
Boundaries: Internet ⇄ Vercel ⇄ Backend ⇄ managed services. The browser never talks to the database; it reaches the backend only through the same-origin proxy.
```

**Assets:** member accounts and sessions; personal data (section 3); quiz results and certificates (the future basis of verified skills); admin powers (approve, delete, change roles, clean data); the audit trail; content; availability of the service.

**Actors:** visitors; members; moderators, instructors; admins and the SuperAdmin; a malicious member; an attacker with only the public internet; a compromised staff account; a provider outage.

## 2. Threats

Severity is the likely worst case for about 2,000 members. "Ref" points to a finding in Doc 04 or a Document 1 risk; "Task" to Document 4.

| ID | Threat | Existing control | Gap and status | Ref | Task |
| --- | --- | --- | --- | --- | --- |
| T-1 | Takeover through the password-reset flow (guessing the 6-digit code, replaying the reset session) | Hashed codes, 10-minute expiry, per-IP throttle | **Fixed on `feat/2.0-stabilise`**: per-email lock after 5 wrong guesses; single-use, expiring session secret. Covered by e2e tests | S-2, S-3 | TASK-013, TASK-009 |
| T-2 | Credential stuffing and brute force on login | Per-IP throttle (5 per 15 minutes) | No per-account lockout; the IP limit can be dodged if the backend is reached directly and the client IP header is spoofed (`trust proxy: true`) | S-11 | TASK-013 |
| T-3 | Creation of a privileged account by anyone holding one shared secret | The secret is required to be non-default at boot | One shared code, no per-person approval, no MFA, no audit row | S-4 | TASK-044 |
| T-4 | Stolen or leftover session | httpOnly cookies, 15-minute access token, rotating refresh with reuse detection | No idle or absolute limits for staff; no step-up for sensitive actions | Doc 09 | TASK-009 |
| T-5 | Broken access control: a route missing the right permission, or a role doing more than allowed | Default-deny guard chain, permission keys, ownership checks | Coverage unproven: 19 e2e tests, no role-by-route matrix over about 102 endpoints | RISK-04 | TASK-008 |
| T-6 | Exposure of private documents (resumes, certificates, evidence) | None needed yet (no such files) | Storage returns public URLs; no scanning, signed links or open logging, so this must be built before any private upload | RISK-09, S-12 | TASK-014 |
| T-7 | Data loss or unfair erasure: deleting an account cascades into other members' replies; deleting a quiz deletes issued certificates; "clean data" deletes with no audit | Re-authentication for self-delete | Cascading deletes; the Supabase login is not removed; clean-data is unaudited | S-5, S-6, S-9, D-1, D-2 | TASK-046, TASK-015 |
| T-8 | Quiz and certificate fraud (unlimited retakes, no timer, guessable certificate numbers) | Answer key hidden from the taking view | No attempt cap, no deadline check, 24-bit random certificate number | S-7, S-8 | TASK-032, TASK-034 |
| T-9 | Abuse of the realtime socket | Cookie-authenticated | Any origin allowed with credentials; token checked only at connect | S-10 | TASK-011 |
| T-10 | Automated abuse of public endpoints (sign-up spam, contact form, certificate lookups) | Global and per-route throttles | No bot protection; verifier not specially limited | RISK-08 | TASK-013 |
| T-11 | Phishing or broken links through email | Links use the configured frontend URL; no localhost links | Sender authentication (SPF, DKIM, DMARC) not verified | OPEN-18 | TASK-021 |
| T-12 | **Admin settings that do nothing**: `registrationEnabled`, `emailVerificationRequired`, `sessionTimeoutMinutes`, `maxUploadSizeMb`, `apiRateLimit` are saved but never enforced | Only `maintenanceMode` is read | An admin can believe registration is closed or sessions are limited when neither is true | Doc 09 | TASK-047, TASK-009 |
| T-13 | Vulnerable dependencies or leaked secrets | `.env` git-ignored; CI installs from a frozen lockfile | No dependency or secret scanning in CI | SEC-12 | TASK-011, TASK-017 |
| T-14 | Breach of privacy duties (DPDP): no consent records, no export, a short placeholder privacy notice, the public certificate verifier shows a real name | Account deletion with password | Consent, notice, export and grievance contact all missing | RISK-02 | TASK-025, TASK-046, TASK-054 |
| T-15 | Outage or data loss: free-tier hosting, cold starts, unknown backups | Health endpoint, queue retries | No restore drill; no alert routing; single instance | RISK-06 | TASK-004, TASK-005 |

**Top three to act on first (Document 4 order):** T-5 (TASK-008, everything depends on it), T-4 and T-12 together (TASK-009), and T-3 (pull TASK-044's invitation step forward). T-1 is done.

## 3. Data map

Where personal data lives, why it is held and who can see it. "Retention" is what the code does today; Document 1 section 10.7 gives the recommended periods.

| Data | Held in | Why | Who can see it | Retention today | Gap |
| --- | --- | --- | --- | --- | --- |
| Name, email | `users` | Account and communication | The member; admins (all); other members see the name on their content; the public sees the name on a certificate verifier | Until the account is deleted | Public verifier shows the name with no consent record |
| Password credential | A bcrypt hash in `users` (local mode) or Supabase Auth (production) | Sign-in | Nobody (hash or provider) | Until deletion (the Supabase credential is **not** removed on deletion) | S-5 |
| WhatsApp number | `users` (optional) | Not stated anywhere; no use found in the code | Admins | Until deletion | Purpose not stated (PRD-010) |
| Experience level, bio, avatar URL, social links | `users`, `user_social_links` | Profile | Members | Until deletion | None found |
| Self-entered certifications | `user_certifications` | Profile | Members | Until deletion | Not evidence (PRD-013) |
| Approval and verification state, last login | `users` | Access control | Admins | Until deletion | None |
| Session records: token hash, **IP address, user agent** | `refresh_tokens` | Session security | Nobody through the UI | Until expiry (7 days) and then retained as revoked or expired rows | No cleanup job found |
| Reset and verification tokens | `password_resets`, `email_verifications` (hashed) | Account recovery | Nobody | Rows remain after use | No cleanup job found |
| Notifications | `notifications` (type and JSON payload) | In-app messages | The recipient | Unbounded | Retention 12 months recommended |
| Admin activity | `admin_activity_logs` (actor, action, target, JSON details such as a deleted user's email) | Audit | Admins | Unbounded | No reason field; contains personal data in details |
| Client error logs | `client_logs` (message, data, user id, **IP**, user agent) | Debugging | Admins | Unbounded | Needs a retention limit and IP minimisation |
| Content: blogs, comments, forum threads and replies, resources, recordings | Content tables | Community | Members; published blogs are public | Until deletion (and cascades with it) | Erasure rules (D-2) |
| Quiz attempts, answers, certificates | `quiz_*`, `certificates` | Assessment and credentials | The member; admins; certificates are verifiable publicly | Until deletion of the quiz or user | Cascade deletion (D-1) |
| Uploaded files | Supabase Storage | Resources and recordings | Anyone with the URL | Until deleted | Public URLs (S-12) |
| Email addresses and message bodies in queue jobs | Redis (BullMQ) | Sending email | Operators of the Redis provider | Until the job is removed | Not verified how long completed jobs are kept |
| Presence (user ids online) | Redis | "Online now" | Admins and the dashboard count | Until disconnect | Stale entries possible |

**Not collected yet, but required by v2 and therefore subject to field-level protection first (TASK-012):** date of birth, years of experience, domain, current role, skills, LinkedIn, current company, CTC, notice period, resumes, evidence files.

## 4. Processors and locations

| Provider | Holds | Location (from configuration) | Agreement |
| --- | --- | --- | --- |
| Supabase | Database, Auth credentials, Storage, Realtime | The connection host indicates **ap-northeast-1 (Tokyo)** | Not verified |
| Render | Backend service and its logs | Singapore (`render.yaml`) | Not verified |
| Vercel | Web app and its logs | Region `sin1` (`vercel.json`) | Not verified |
| Redis provider | Queues and presence | Not verified (an Upstash URL appears in a commented line of the env file) | Not verified |
| Email provider | Recipient addresses and message text | Resend or an SMTP host, per configuration | Not verified |

All appear to be outside India. DPDP generally permits transfers unless a country is restricted, and PRD-045 requires processing agreements with every provider, so counsel should confirm the position (RISK-02).

## 5. What this draft still needs

1. A second reviewer and the owner's approval (Document 4: TASK-002 acceptance).
2. Production facts that cannot be read from the repository: actual hosting plans and regions, backup settings, which email and Redis providers are live, and whether any private files already exist in Storage.
3. Re-run after TASK-008 produces the route inventory, so T-5 can be graded on evidence.
