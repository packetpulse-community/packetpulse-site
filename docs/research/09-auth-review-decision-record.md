# 09. Authentication Review and Decision Record (TASK-006)

Part of the [research pack](00-index.md). Answers **DEV-05** (how sign-in and sessions work today) and records the decision required by **TASK-006** against the baseline in Document 1 section 10.9 (**OPEN-13**) and **DEC-020** / **PRD-042**. Status: **Proposed, awaiting the owner's approval** (OPEN-13's decider is the tech lead). Evidence is from the code at the head of `feat/2.0-stabilise`.

## 1. How it works today

| Part | Behaviour | Source |
| --- | --- | --- |
| Credentials | Behind a `CredentialProvider`: a local bcrypt hash (`PLATFORM_MODE=docker`) or Supabase Auth (`supabase`, the production mode) | `identity/infrastructure` |
| Session | Our own JWT access token (15 min) plus a database-backed rotating refresh token (7 days), both in httpOnly, `sameSite=lax`, `secure`-in-production cookies | `token.service.ts`, `auth-cookie.service.ts` |
| Refresh | 48 random bytes, stored as SHA-256, rotated on use, whole family revoked on reuse | `token.service.ts` |
| Login gate | Password first, then maintenance, then approval, then email verification | `auth.service.ts` |
| Email verification | A 24 hour single-use link, sent when an admin approves | `email-verification.service.ts` |
| Password reset | 6-digit code (10 min), now locked after 5 wrong guesses per email, exchanged for a single-use, 10-minute session secret (fixed on this branch: S-2, S-3) | `auth.service.ts` |
| Admin creation | A public endpoint gated by one shared `ADMIN_SECURE_CODE`; creates an approved, verified admin | `registerAdmin` |
| Roles and approval | Permission-based guards; `isApproved` re-read from the database each request | `approved.guard.ts`, `roles.guard.ts` |

## 2. Review against the baseline

| Baseline (OPEN-13, DEC-020) | Today | Gap | Closed by |
| --- | --- | --- | --- |
| Passwords at least 12 characters, checked against breached lists, no complexity rules, no forced rotation | 8 characters with four complexity rules (`PASSWORD_RULES`); no breach check | Weaker length, stricter-than-recommended rules, no breach check | TASK-022 |
| Passkeys offered | None | Missing | TASK-022 or TASK-044 |
| MFA required for Admin, SuperAdmin, Recruiter; optional for members; authenticator app or passkey, never SMS | None | Missing | TASK-044 |
| Member sessions: sign out after 30 days idle | Refresh token lasts 7 days from issue; idle is not tracked | Different (shorter absolute lifetime, no idle rule) | TASK-009 |
| Staff sessions: 30 minutes idle and 8 hours absolute | Same as members | Missing. The admin Settings screen has a `sessionTimeoutMinutes` field that is stored but **never enforced** | TASK-009 |
| Step-up (reason and a fresh code) for sensitive actions | None | Missing | TASK-009, TASK-044 |
| Lockout after 5 wrong codes, 15 minutes | Per-IP throttle (5 per 15 minutes) on auth routes; per-email lock on reset codes (this branch) | Partial. Login has no per-account lockout; the IP limit can be dodged when `trust proxy` is spoofable (S-11) | TASK-013 |
| Recovery: members by email; staff only through a SuperAdmin with a second approver | Everyone recovers by email code; no staff path | Missing for staff | TASK-044 |
| No temporary passwords for admins | Admins choose their own password at signup with a shared code | Met for passwords, but creation is by shared secret (S-4) | TASK-044 |
| Verified email with a 6-digit code, limited attempts and resends (PRD-001) | Link-based, sent only after admin approval | Different mechanism and timing | TASK-022, DEC-035 |
| Optional sign-in with LinkedIn | None | Missing | Later, optional |

**Strengths to keep:** rotating refresh tokens with reuse detection and family revocation, hashed token storage, httpOnly cookies, default-deny guards, answers that do not reveal which emails exist after the password check, session revocation on password change.

## 3. Findings that affect this decision

- **S-4** the shared-secret admin signup is the largest single privilege risk.
- **S-11** `trust proxy: true` lets a caller who reaches the backend directly vary the client IP and avoid per-IP limits.
- **S-13** the login path returns early for unknown emails, so timing can reveal which addresses exist.
- **Settings that do nothing:** `registrationEnabled`, `emailVerificationRequired`, `sessionTimeoutMinutes`, `maxUploadSizeMb` and `apiRateLimit` are editable by admins but not enforced (only `maintenanceMode` is). An admin who switches registration off will believe it is off.

## 4. Decision (proposed)

**Keep the current authentication method.** Our own JWT sessions with rotating refresh tokens, with credentials in Supabase Auth in production, can meet the baseline with additive work. No library or provider change is needed, which satisfies DEC-023 and DEC-025. The plan below closes the gaps in Document 4 order.

| Step | Work | Task | Milestone |
| --- | --- | --- | --- |
| 1 | Reset-code lock and single-use reset session | Done on this branch | M1 |
| 2 | Enforce session rules: staff 30 minutes idle and 8 hours absolute; members 30 days idle. Either make the `sessionTimeoutMinutes` setting real or remove it | TASK-009 | M1 |
| 3 | Per-account login lockout; restrict proxy trust; decide on bot protection | TASK-013 | M1 |
| 4 | Remove shared-secret admin signup; invite staff through a SuperAdmin; audit the creation | TASK-044 (start early) | M7, pulled forward |
| 5 | Staff MFA (authenticator app or passkey), step-up with reason and fresh code, break-glass with a second SuperAdmin. Evaluate Supabase Auth's MFA support first | TASK-009, TASK-044 | M1 and M7 |
| 6 | Password policy: 12 characters, breached-password check, drop the complexity rules; offer passkeys | TASK-022 | M3 |
| 7 | Email verification by 6-digit code at registration with attempt and resend limits, once DEC-035 is decided | TASK-022 | M3 |

## 5. What the owner needs to decide

1. Approve or change the decision above (OPEN-13).
2. DEC-035: when the verification email is sent, and whether access waits for approval (Doc 01 s4; affects step 7).
3. Whether admin signup by shared secret is switched off now or kept until step 4 (recommended: switch it off in production first, since it has no per-person approval).
4. Make the unenforced settings real (recommended for `registrationEnabled`, `sessionTimeoutMinutes` and `emailVerificationRequired`), or remove them from the screen so they do not mislead.

## 6. Not verified

Supabase Auth's own password and MFA capabilities on your plan; what the production environment sets for `trust proxy` hops; production cookie behaviour behind Vercel; whether existing admin accounts were created through the shared-secret route.
