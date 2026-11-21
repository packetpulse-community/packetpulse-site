# Data rights and retention (TASK-046)

Implements PRD-045 (DPDP: export, erasure, retention), SCR-038 (data-rights screen), API-009, DB-028, TEST-041,
and the fixes for S-5 (deleting an account left the Supabase login behind) and D-2 (deleting a user cascaded into
other members' threads). Owner: `apps/backend/src/modules/data-rights`. Every number below lives in
`packages/types/src/data-rights.ts`; this page is written from that file.

**Status: the periods are suggestions from Document 1 section 10.7 (OPEN-06, "counsel to confirm"). Nothing here is legal advice.**

## What the member can do

| Action | Route | Rules |
|---|---|---|
| See requests | `GET /api/data-rights` | own data only |
| Ask for an export | `POST /api/data-rights/export` | one open export per member (409); switch `data_rights.export` (default on) |
| Download | `POST /api/data-rights/export/link` | own prepared export only; a 5-minute signed URL; logged in `file_access_logs` and the audit log |
| Discard | `DELETE /api/data-rights/export` | removes the file |
| Delete my account | `POST /api/data-rights/erasure` (and the old `DELETE /api/users/profile`) | password re-entry; 30-day grace; one open request (409) |
| Cancel the deletion | `DELETE /api/data-rights/erasure` | allowed until the erasure job claims the request |
| Staff list | `GET /api/admin/data-requests` (`admin:view-analytics`) | read only; requests and their audit entries; no route opens a file |

All member routes work for pending, unverified and deactivated accounts (`@SkipApproval`, `@SkipEmailVerification`, `@AllowDeactivated`).

## Values the documents left open, and the default chosen

| Value | Document says | Default chosen | Where |
|---|---|---|---|
| Deletion grace period | 30 days (Doc 3 SCR-038) | 30 days | `ERASURE_GRACE_DAYS` |
| How long an export is available | "The link works for 7 days" (Doc 3 SCR-038) | the file is kept 7 days after it is ready | `EXPORT_AVAILABLE_DAYS` |
| Signed download link lifetime | not stated | 300 seconds, a new one per click (the member is signed in; the email only points at the page) | `EXPORT_LINK_TTL_SECONDS` |
| Export format | not stated | one zip of JSON files plus a README | `export-collector.service.ts` |
| Erasure SLA | "within 30 days of a request" (Doc 1 s10.7) | the grace period is the 30 days; the job runs within the hour after it ends | sweep, hourly |
| Job retries | not stated | export 3 attempts, erasure 5, then the request is marked failed / left scheduled for the next sweep | `EXPORT_MAX_ATTEMPTS` |
| Re-authentication for deletion | "password or a code" | password (a code needs the step-up work in TASK-044) | `RequestErasureSchema` |
| Session, auth-code and client-log retention | "no cleanup job found" (Doc 10) | 30, 7 and 90 days | `RETENTION_RULES` |
| Finished data requests | not stated | 3 years, same as consent proof | `RETENTION_RULES` |
| Certificates after erasure | "keep certificate verification records" | kept, holder shown as "Deleted member" | `ERASURE_RULES` |

## Erasure: what is deleted, anonymised or kept

The user row is **never deleted**. It becomes a tombstone (`erased_at` set, name "Deleted member", email `erased-<id>@erased.invalid`, every
personal column empty, no roles, no password). Content, certificates, the reputation ledger and the audit trail keep a valid reference
to it, which is what stops the old cascade (D-2) and keeps the append-only tables intact.

| Data | Outcome | Why |
|---|---|---|
| Sign-in credential (password hash, or the Supabase Auth login) | deleted | You can no longer sign in, and the email address can be used to register again. |
| Sessions, refresh tokens, password-reset and verification records | deleted | Nothing should keep working after erasure. |
| Name, email, phone, date of birth, bio, avatar, target role, career goals, social links, certifications you typed in | deleted | Personal details; the account row is replaced by an empty tombstone. |
| Roles and approval | deleted | The tombstone has no access. |
| Notification preferences, quiet hours, WhatsApp number and profile visibility settings | deleted | Personal settings. |
| In-app notifications and delivery records | deleted | Only meaningful to you. |
| Skills on your profile | deleted | Part of your profile. |
| Uploaded private files (resumes, evidence) and earlier data exports | deleted | Files are removed from storage; the access log entries stay (see below). |
| Likes on posts, replies, resources and recordings, recordings you joined, and the community guidelines you accepted | deleted | Personal activity. |
| Quiz attempts and answers that did not earn a certificate | deleted | Your learning history. |
| Forum threads that nobody else replied to | deleted | No one depends on them. |
| Unpublished blog posts | deleted | Never shown to anyone. |
| Published blog posts and comments, resources, recordings, forum replies and threads others replied to | anonymised | Others depend on them (Document 1 section 10.7); your name is removed and shown as "Deleted member". |
| Certificates you earned and the attempt behind each | anonymised | A certificate number must keep verifying for whoever relied on it; the verifier shows "Deleted member" instead of your name. |
| Consent history (what you agreed to and when) | kept | Proof that consent was lawful; kept 3 years after erasure, then deleted. |
| Reports you made about forum posts | kept | Moderation records; they point at the empty tombstone, not at you. |
| Reputation ledger entries | kept | Append-only; no personal data, attached to the tombstone. |
| Audit log entries about your account and staff actions on it | kept | The audit log is append-only and kept at least 3 years. |
| Private-file access log | kept | Append-only record of who opened files; holds no file contents. |
| The erasure request itself (date and outcome) | kept | Proof the request was completed; kept 3 years. |
| Browser error logs linked to you | anonymised | The link to you and the IP address are removed; the error text is kept for debugging until it ages out. |

Order of work in the job (`AccountErasureService.erase`): claim the request, remove the login (`CredentialProvider.deleteCredential`: the Supabase
Auth user in supabase mode, nothing in docker mode), delete the stored files from the bucket, one database transaction for everything else,
then the final "your account was deleted" email (sent without a delivery row, to the address captured before it was cleared). A failure in the
first three releases the claim so the queue's retry, or the next hourly sweep, tries again; every step is safe to repeat.

Not covered by the job, on purpose:

- **Backups** keep erased data until their normal rotation and are never restored over erased accounts (Document 1 s10.7). See `docs/ops/backups.md`.
- **Email provider and Redis**: queued email jobs hold an address for up to 24 hours (completed) or 7 days (failed) (`docs/ops/background-jobs.md`).
- **Staff erasure**: the admin "delete user" action now calls the same erasure with no grace period (and writes `user_deleted` first).
- The audit log may still name an email in the `details` of older rows (`user_deleted`, `admin_registered`). It is append-only; an owner decision is needed if those must be redacted.

## Retention schedule

Applied by `RetentionService.run(now)` (hourly sweep, or on demand). `now` is a parameter, so tests move the clock.

| Data | Kept for | Automated | Source |
|---|---|---|---|
| Sign-in sessions (token hash, IP address, device) | 30 days after expiry or revocation | yes | Doc 10 data map: no cleanup existed; default chosen |
| Password-reset, email-verification and email-code records | 7 days after expiry | yes | Doc 10 data map: no cleanup existed; default chosen |
| In-app notifications | 1 years after creation | yes | Document 1 s10.7: 12 months |
| Notification delivery log | 1 years after creation | yes | Document 1 s10.7: 12 months |
| Browser error logs (IP, user agent) | 90 days after creation | yes | Doc 10 data map: needs a limit; default chosen |
| Prepared data exports | 7 days after the export being ready | yes | Document 3 SCR-038: 7 days |
| Consent history of an erased account | 3 years after erasure | yes | Document 1 s10.7: account life plus 3 years |
| Finished export and erasure requests | 3 years after completion | yes | Default chosen: same 3 years as consent proof |
| Erased-account tombstones (no personal data) | no automatic limit | no | Content and certificates point at them; removed only with that content |
| Audit log (admin activity log) | no automatic limit | no | Document 1 s10.7: at least 3 years; append-only, never purged by code |
| Private-file access log | no automatic limit | no | Append-only (database trigger) |
| Inactive accounts (notice after 2 years, erasure after 3) | no automatic limit | no | Document 1 s10.7; not automated until counsel confirms and a notice email exists |

Never purged by code: `admin_activity_logs` (a trigger refuses UPDATE and DELETE), `file_access_logs` (same), `forum_reputation_events` (same).
Consent records are removed only for accounts erased more than 3 years ago; the table refuses UPDATE, not DELETE.

## Jobs

One BullMQ queue, `data-rights`, worker in the API process (`DataRightsProcessor`), no new dependency.

| Job | Id | Does |
|---|---|---|
| `export` | `data-export-<hash of request id>` | builds the zip, stores it as a `data_export` `StoredFile`, audits, emails the notice. Idempotent: conditional status claims, deterministic storage path, a second run is skipped |
| `erase` | `data-erase-<hash of request id>` | the erasure above. Idempotent: a completed or not-yet-due request is skipped |
| `sweep` | scheduler `data-rights-sweep`, every hour | queues due erasures, expires exports past their date, re-queues exports the queue lost, runs the retention deletes |

The sweep scheduler is registered at start-up with `upsertJobScheduler` (safe from several replicas). It is **off when `NODE_ENV=test`** unless
`DATA_RIGHTS_SCHEDULER=on`. Failed jobs alert like the other queues (`"alert":true`, see `docs/ops/background-jobs.md`).

Run the sweep by hand from `apps/backend` (needs `DATABASE_URL` and `REDIS_URL` for the target environment):

```bash
node -e 'const {Queue}=require("bullmq");const q=new Queue("data-rights",{connection:{url:process.env.REDIS_URL}});q.add("sweep",{}).then(()=>q.close())'
```

## Audit entries

`data_export_requested`, `data_export_ready`, `data_export_downloaded`, `data_export_discarded`, `data_export_expired`,
`account_deletion_requested`, `account_deletion_cancelled`, `account_erased`, `retention_cleanup_run` (only when something was deleted).
Entries carry ids and counts, never names, emails or file contents.

## Notices

Two critical notification events (`data_export_ready`, `account_deletion`): email only, through the dispatcher, so the delivery is logged and
quiet hours and the daily cap do not delay them. The email never contains the file or a download link, only the page address.

## Decisions the owner (and counsel) still need to make

1. **Legal retention periods** (OPEN-06): confirm or replace every number above, especially consent proof (3 years), the audit log (at least 3 years, no purge), finished requests (3 years), client logs (90 days) and sessions (30 days).
2. **Inactive accounts**: Document 1 suggests notice after 2 years and erasure after 3. Not automated: it needs counsel's confirmation and an email notice.
3. **Certificates**: confirm a certificate may keep verifying after erasure without the holder's name.
4. **Redacting audit `details`** that hold an email (older rows).
5. **Processor agreements** (PRD-045) for Supabase, the email provider and Redis, and the **grievance contact** line on the page (not part of this task).
6. **Code instead of password** for re-authentication once TASK-044 lands.
