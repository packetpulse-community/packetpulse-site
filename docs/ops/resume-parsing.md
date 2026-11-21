# Resume upload and parsing (TASK-024)

Implements PRD-007 (resume upload, parsed values reviewed, nothing saved until confirmed, a parse failure never blocks manual entry),
PRD-046 / SEC-03 (private, short-lived links, every open logged), API-007, DB-005, SCR-012 (profile: resume review), WF-001 and TEST-004.
Owner: `apps/backend/src/modules/resumes`; web: `apps/web/src/features/resumes`. Shared limits and the plain-language failure
messages live in `packages/types/src/resumes.ts`; this page is written from that file and from the code.

## How it works

1. **Consent first.** Upload is refused with a plain 403 until the member has granted `resume_sharing` (the consent record is the proof).
   Withdrawing it later does not delete the resume (the member keeps it) but stops staff from opening it and blocks new uploads.
2. **Upload** (`POST /api/resumes/upload-url`): creates a pending private file (kind `resume`) and a `Resume` row (`awaiting_upload`), returns a
   signed upload URL. The browser PUTs the bytes straight to storage; our server never carries them. PDF and DOCX only, up to 5 MB.
3. **Complete** (`POST /api/resumes/:id/complete`): the existing file pipeline checks size and file signature (and ClamAV when `CLAMAV_HOST` is set).
   A bad file is removed and the resume row with it (400, plain message). A good one becomes the **current** version (the previous current moves to
   history) and a parse job is queued.
4. **Parse** (BullMQ queue `resume-parse`, worker in the API process, concurrency 1): reads the bytes, hands them to an isolated worker thread that
   returns only text, matches the text against the skill taxonomy and finds education and experience, and stores **suggestions**.
5. **Review** (`PUT /api/resumes/suggestions/:id`, `accept` or `reject`): one field at a time. Accepting a skill adds a member skill (25 cap, active
   taxonomy skills only, default visibility `members`, label self declared); accepting education or experience adds a profile entry. Nothing is
   applied automatically.

Resume states the member sees: *uploading* (browser), *scanning* (the complete call), *parsing*, *ready*, *failed* (a plain message, manual entry
still works), *rejected* (the content check removed the file).

## Safety properties

| Concern | What is done |
|---|---|
| Never public | Private bucket, signed 60-second links only (`GET /api/resumes/:id/link`, or `/api/files/:id/link`), one `canOpen` policy, every open and every refusal logged in `file_access_logs`. Responses never carry a path, bucket or public URL. |
| Who can open | The owner. Staff (`admin`, `super_admin`) only while the owner's latest `resume_sharing` decision is `granted` **and** the resume has finished parsing (`ready` or `failed`). Everyone else gets 404 and a `denied` log row. |
| Generic routes | `/api/files/upload-url`, `/complete` and `DELETE` refuse kind `resume` (they would bypass consent and parsing). |
| No execution of content | DOCX text comes from string replacement on `word/document.xml`, never an XML parser (no entity expansion, no external fetch). PDF text comes from `pdfjs-dist` with `isEvalSupported: false`, XFA off, no rendering, no fonts loaded. |
| Active content | A DOCX with macros (`vbaProject.bin`, `macroEnabled` content type), embedded objects, ActiveX or a remote template, or a PDF with JavaScript, launch actions, embedded files or rich media (also with `#xx`-obfuscated names), is **rejected and deleted** from storage. The member is told in plain words. |
| Zip bombs | The zip directory is listed without inflating. Refused above 400 entries, 60 MB declared in total, 6 MB for `document.xml`, or a ratio above 250:1 on a large entry. A directory that lies about sizes is read only up to the declared size. |
| Memory and time | Extraction runs in a worker thread with a 192 MB heap ceiling and a 20 second kill timer; the API process is not affected. Text is capped at 120,000 characters and PDFs at the first 15 pages. |
| Idempotent | Conditional claim (`parsing` + not claimed in the last 5 minutes); suggestions are unique by (resume, fingerprint); a repeated or racing job is skipped. Queue job id = resume id + run number. |
| Retries | Only infrastructure errors (storage unreachable, worker crash) retry: 3 attempts, exponential backoff. A file problem ends in a plain failed state at once. After the last attempt the resume is `failed` (`failed` code). |
| Sweep | Every 10 minutes (`resume-sweep` scheduler; off when `NODE_ENV=test` unless `RESUMES_SCHEDULER=on`): re-queues a parse that has been stuck for 5 minutes, marks one failed after 5 runs, drops uploads never completed after 24 hours. |
| Parser library | `pdfjs-dist` 6.4.299 (published 2026-10-03) and `fflate` 0.8.3, both older than two weeks, exact versions, no advisory in `pnpm audit --prod`. pdfjs's optional native canvas package is removed by a root `pnpm.overrides` entry (`"@napi-rs/canvas": "-"`): we never render. |

## Values the documents leave open, and the default chosen

| Value | Document says | Default chosen | Where |
|---|---|---|---|
| File types | PRD-007 "PDF, DOC and DOCX"; task brief "PDF and DOCX only" | PDF and DOCX. Legacy DOC is refused (it is a macro-capable binary format and cannot be read safely here) | `RESUME_CONTENT_TYPES`, `FILE_CONTENT_TYPES.resume` |
| Size cap | 5 MB | 5 MB (the existing pipeline cap) | `RESUME_MAX_BYTES` |
| Which consent gates upload | PRD-010 lists "resume sharing" | `resume_sharing` must be `granted` (any policy version) before the first upload and each replacement | `ResumesService.startUpload` |
| Resume visibility | "private by default" | Always private: the only readers are the owner and, with `resume_sharing`, staff via `canOpen`. No setting makes it more public. Recruiter access is not built (SCR-020, later) | `canOpen`, `ResumeView.visibility` |
| Versions kept | "version history" (no number) | Current + 4 earlier = 5; a replace deletes the oldest beyond that | `RESUME_MAX_VERSIONS` |
| A replacement that fails | not stated | The old resume stays current; the failed upload is removed | `ResumesService.complete` |
| Parse timeout | not stated | 20 seconds per file, then a plain "took too long" failure that can be retried | `RESUME_PARSE_TIMEOUT_MS` |
| Suggestion caps per resume | not stated | 40 skills, 8 education, 15 experience | `RESUME_MAX_SUGGESTIONS` |
| Skill matching | "matched to the taxonomy" | By name and alias, ignoring case and punctuation (same key as DEC-014 clear-match). Names under 3 letters ("C", "R", "Go") are never matched by wording. A broad (major) skill matches only inside a skills section. Retired skills and skills the member already has are never suggested. A skill not in the taxonomy is not suggested at all (the member uses the skill-suggestion flow) | `resume-text-parser.ts` |
| Accepted skill visibility | not stated | `members` (the skill default D2) | `DEFAULT_SKILL_VISIBILITY` |
| Dates | "experience dates" | Month and year when the resume gives both (`YYYY-MM`), year only otherwise; years before 1960 or after next year, and an end before a start, are dropped | `resume-text-parser.ts` |
| Where accepted education / experience go | no profile model exists | Two new small tables, `member_education` and `member_experience`, one row per accepted suggestion; the member can remove a row (its suggestion returns to pending). No other screen shows them yet (public profile is TASK-022/023) | schema, `GET /api/resumes/profile-entries` |
| Changing a decision | not stated | pending to accepted or rejected; rejected can still be accepted; accepted cannot be rejected (remove it from the profile instead) | `ResumesService.decide` |
| Delete a resume | not stated | Deletes the file and its suggestions. Skills and entries already accepted stay on the profile (they are the member's profile data) | `ResumesService.remove` |
| Switch | "add one if the pattern calls for it" | `resumes.upload` (public, default on): off stops new uploads and re-reads; viewing, opening and deleting keep working. `files.uploads` off also stops uploads | `feature-flag.registry.ts` |
| Abandoned upload | not stated | Removed after 24 hours | `ABANDONED_UPLOAD_AFTER_MS` |
| Audit entries | not stated | None added: the file access log already records every upload URL, completion, open, denial and delete. No new audit action (no enum change) | |
| Retention and erasure | OPEN-06 | Kept until the member deletes it or erases the account; the export carries every stored version, `resumes.json` and the decisions; erasure deletes everything (see `data-retention.md`) | |

## Operating it

- Failed parse jobs alert like the other queues (`"alert":true`, `docs/ops/background-jobs.md`). Inspect and retry with the same commands, queue name `resume-parse`.
- A resume stuck in `parsing` is picked up by the sweep; the member can also press "Read it again" once it shows failed.
- The upload itself needs a real storage backend that accepts signed PUT URLs (Supabase). In `PLATFORM_MODE=docker` the local storage provider has no HTTP
  route for uploads (by design), so the browser step cannot complete there; the tests use the provider's `putWithToken`.
- The browser PUTs to the storage origin, so `connect-src` in the CSP (`apps/web/src/shared/security/csp.ts`) must allow the Supabase origin. It already does when `NEXT_PUBLIC_SUPABASE_URL` is set.

## Decisions the owner still needs to make

1. **Is the `resume_sharing` consent the right gate?** It reads "Share my resume with PacketPulse reviewers". Here it gates upload itself; if the owner wants a member to be able to keep a resume purely for their own use without agreeing to sharing, the gate moves to a separate "store my resume" purpose (needs a consent-policy publish).
2. **Staff access.** Today any admin can open a resume while consent stands, with each open logged. There is no staff list of resumes yet (a recruiter or reviewer screen is a later task); say whether admins should be able to open resumes at all or only a named reviewer role.
3. **Accepting education and experience.** They land in new profile tables nothing else shows yet. Confirm that is the intended home, or point them at the profile model TASK-022/023 will define.
4. **Versions kept (5)** and the **20-second timeout**.
5. **Scanned resumes (OCR)** are not read; the member is asked for a text version. AI extraction is TASK-055 and stays out.
6. **Antivirus.** Without `CLAMAV_HOST` the upload check is type, size and signature only; the content check above catches active content but is not an antivirus.
