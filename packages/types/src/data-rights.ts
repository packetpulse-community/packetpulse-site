import { z } from "zod";
import { PaginationQuerySchema } from "./common";

// Data rights (TASK-046, PRD-045, SCR-038, API-009, DB-028, TEST-041): export my data, delete my
// account after a grace period, and the retention schedule. Document 1 section 10.7 gives the
// suggested periods; they are marked "counsel to confirm" there (OPEN-06), so every number lives
// here, in one place, and docs/ops/data-retention.md is written from this file.

export const DATA_REQUEST_KINDS = ["export", "erasure"] as const;
export type DataRequestKind = (typeof DATA_REQUEST_KINDS)[number];

export const DATA_REQUEST_STATUSES = [
  "requested",
  "preparing",
  "ready",
  "scheduled",
  "completed",
  "cancelled",
  "expired",
  "failed",
] as const;
export type DataRequestStatus = (typeof DATA_REQUEST_STATUSES)[number];

/** Days between confirming an erasure request and the erasure itself (Document 3 SCR-038: 30). */
export const ERASURE_GRACE_DAYS = 30;
/** Days a prepared export stays available (Document 3 SCR-038: "The link works for 7 days"). */
export const EXPORT_AVAILABLE_DAYS = 7;
/** Each download link is short-lived; the member asks for a fresh one while the export is ready. */
export const EXPORT_LINK_TTL_SECONDS = 300;
/** How many times the job retries before the request is marked failed. */
export const EXPORT_MAX_ATTEMPTS = 3;

export const DAY_MS = 24 * 60 * 60 * 1000;

export const RequestErasureSchema = z.object({
  // Re-entered on purpose (SCR-038): a stolen session alone cannot start a deletion.
  password: z.string().min(1, "Enter your password to confirm").max(200),
});
export type RequestErasureDto = z.infer<typeof RequestErasureSchema>;

export const AdminDataRequestListQuerySchema = PaginationQuerySchema.extend({
  kind: z.enum(DATA_REQUEST_KINDS).optional(),
  // "open" (default) = not finished; "all" also lists finished ones.
  scope: z.enum(["open", "all"]).default("open"),
});
export type AdminDataRequestListQuery = z.infer<typeof AdminDataRequestListQuerySchema>;

/** One request as the member sees it. */
export interface DataRequestView {
  id: string;
  kind: DataRequestKind;
  status: DataRequestStatus;
  requestedAt: string;
  /** erasure: when the account will be erased unless the request is cancelled. */
  scheduledFor: string | null;
  /** export: when the file was finished and when it stops being available. */
  readyAt: string | null;
  expiresAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
}

/** GET /data-rights: the member's latest request of each kind plus what the page needs to explain. */
export interface DataRightsOverview {
  export: DataRequestView | null;
  erasure: DataRequestView | null;
  exportEnabled: boolean;
  graceDays: number;
  exportAvailableDays: number;
}

export interface DataExportLink {
  url: string;
  expiresInSeconds: number;
  fileName: string;
}

/** Admin list (read-only): who has a request open and where it stands. No export contents. */
export interface AdminDataRequestView extends DataRequestView {
  user: { id: string; firstName: string; lastName: string; email: string; erased: boolean };
  audit: { action: string; at: string }[];
}

// ---------------------------------------------------------------------------------------------
// What happens to each kind of data at erasure (D-2, S-5). Rendered on the data-rights page and in
// docs/ops/data-retention.md; the erasure job implements exactly these rows.
// ---------------------------------------------------------------------------------------------

export type ErasureOutcome = "deleted" | "anonymised" | "kept";

export interface ErasureRule {
  key: string;
  data: string;
  outcome: ErasureOutcome;
  /** Why, in plain words (shown to the member). */
  reason: string;
}

export const ERASURE_RULES: readonly ErasureRule[] = [
  { key: "login", data: "Sign-in credential (password hash, or the Supabase Auth login)", outcome: "deleted", reason: "You can no longer sign in, and the email address can be used to register again." },
  { key: "sessions", data: "Sessions, refresh tokens, password-reset and verification records", outcome: "deleted", reason: "Nothing should keep working after erasure." },
  { key: "profile", data: "Name, email, phone, date of birth, bio, avatar, target role, career goals, social links, certifications you typed in", outcome: "deleted", reason: "Personal details; the account row is replaced by an empty tombstone." },
  { key: "roles", data: "Roles and approval", outcome: "deleted", reason: "The tombstone has no access." },
  { key: "preferences", data: "Notification preferences, quiet hours, WhatsApp number and profile visibility settings", outcome: "deleted", reason: "Personal settings." },
  { key: "notifications", data: "In-app notifications and delivery records", outcome: "deleted", reason: "Only meaningful to you." },
  { key: "skills", data: "Skills on your profile", outcome: "deleted", reason: "Part of your profile." },
  { key: "files", data: "Uploaded private files (resumes, evidence) and earlier data exports", outcome: "deleted", reason: "Files are removed from storage; the access log entries stay (see below)." },
  { key: "likes", data: "Likes on posts, replies, resources and recordings", outcome: "deleted", reason: "Personal activity." },
  { key: "quiz-attempts", data: "Quiz attempts and answers that did not earn a certificate", outcome: "deleted", reason: "Your learning history." },
  { key: "unanswered-threads", data: "Forum threads that nobody else replied to", outcome: "deleted", reason: "No one depends on them." },
  { key: "drafts", data: "Unpublished blog posts", outcome: "deleted", reason: "Never shown to anyone." },
  { key: "content", data: "Published blog posts and comments, resources, recordings, forum replies and threads others replied to", outcome: "anonymised", reason: "Others depend on them (Document 1 section 10.7); your name is removed and shown as \"Deleted member\"." },
  { key: "certificates", data: "Certificates you earned and the attempt behind each", outcome: "anonymised", reason: "A certificate number must keep verifying for whoever relied on it; the verifier shows \"Deleted member\" instead of your name." },
  { key: "consent", data: "Consent history (what you agreed to and when)", outcome: "kept", reason: "Proof that consent was lawful; kept 3 years after erasure, then deleted." },
  { key: "reputation", data: "Reputation ledger entries", outcome: "kept", reason: "Append-only; no personal data, attached to the tombstone." },
  { key: "audit", data: "Audit log entries about your account and staff actions on it", outcome: "kept", reason: "The audit log is append-only and kept at least 3 years." },
  { key: "access-log", data: "Private-file access log", outcome: "kept", reason: "Append-only record of who opened files; holds no file contents." },
  { key: "request", data: "The erasure request itself (date and outcome)", outcome: "kept", reason: "Proof the request was completed; kept 3 years." },
  { key: "client-logs", data: "Browser error logs linked to you", outcome: "anonymised", reason: "The link to you and the IP address are removed; the error text is kept for debugging until it ages out." },
];

// ---------------------------------------------------------------------------------------------
// Retention schedule (Document 1 section 10.7, OPEN-06, data map in doc 10). `days: null` = no
// automatic limit here (kept for the reason given). The cleanup job reads `days` for the rows
// marked `automated`.
// ---------------------------------------------------------------------------------------------

export interface RetentionRule {
  key: string;
  data: string;
  /** Days after the reference point; null = no automatic deletion. */
  days: number | null;
  /** What the days count from. */
  from: string;
  automated: boolean;
  source: string;
}

export const RETENTION_RULES: readonly RetentionRule[] = [
  { key: "refresh_tokens", data: "Sign-in sessions (token hash, IP address, device)", days: 30, from: "expiry or revocation", automated: true, source: "Doc 10 data map: no cleanup existed; default chosen" },
  { key: "auth_codes", data: "Password-reset, email-verification and email-code records", days: 7, from: "expiry", automated: true, source: "Doc 10 data map: no cleanup existed; default chosen" },
  { key: "notifications", data: "In-app notifications", days: 365, from: "creation", automated: true, source: "Document 1 s10.7: 12 months" },
  { key: "notification_deliveries", data: "Notification delivery log", days: 365, from: "creation", automated: true, source: "Document 1 s10.7: 12 months" },
  { key: "client_logs", data: "Browser error logs (IP, user agent)", days: 90, from: "creation", automated: true, source: "Doc 10 data map: needs a limit; default chosen" },
  { key: "export_files", data: "Prepared data exports", days: EXPORT_AVAILABLE_DAYS, from: "the export being ready", automated: true, source: "Document 3 SCR-038: 7 days" },
  { key: "consent_after_erasure", data: "Consent history of an erased account", days: 1095, from: "erasure", automated: true, source: "Document 1 s10.7: account life plus 3 years" },
  { key: "data_requests", data: "Finished export and erasure requests", days: 1095, from: "completion", automated: true, source: "Default chosen: same 3 years as consent proof" },
  { key: "tombstones", data: "Erased-account tombstones (no personal data)", days: null, from: "erasure", automated: false, source: "Content and certificates point at them; removed only with that content" },
  { key: "audit_log", data: "Audit log (admin activity log)", days: null, from: "creation", automated: false, source: "Document 1 s10.7: at least 3 years; append-only, never purged by code" },
  { key: "file_access_log", data: "Private-file access log", days: null, from: "creation", automated: false, source: "Append-only (database trigger)" },
  { key: "inactive_accounts", data: "Inactive accounts (notice after 2 years, erasure after 3)", days: null, from: "last sign-in", automated: false, source: "Document 1 s10.7; not automated until counsel confirms and a notice email exists" },
];

export const retentionDays = (key: string): number => {
  const rule = RETENTION_RULES.find((r) => r.key === key);
  if (!rule || rule.days === null) throw new Error(`Retention rule ${key} has no automatic period`);
  return rule.days;
};
