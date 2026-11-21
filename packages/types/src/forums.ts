import { z } from "zod";
import { PaginationQuerySchema } from "./common";

// TASK-026 (PRD-024..028, PRD-054, DB-013, DB-030, API-023). Values the documents leave open are
// named constants here so one edit changes them.

export const FORUM_THREAD_MODES = ["learning", "production", "expert"] as const;
export const ForumThreadModeSchema = z.enum(FORUM_THREAD_MODES);
export type ForumThreadMode = z.infer<typeof ForumThreadModeSchema>;
export const FORUM_MODE_LABELS: Record<ForumThreadMode, string> = {
  learning: "Learning",
  production: "Production issue",
  expert: "Expert design",
};

// PRD-024: title at least 8 characters, detail at least 20, and a confirmation that credentials and
// customer data were removed.
export const FORUM_TITLE_MIN = 8;
export const FORUM_DETAIL_MIN = 20;
export const FORUM_REASON_MIN = 5;
export const FORUM_REASON_MAX = 500;

export const CreateForumThreadSchema = z.object({
  categoryId: z.string().uuid(),
  title: z.string().trim().min(FORUM_TITLE_MIN, `Title needs at least ${FORUM_TITLE_MIN} characters`).max(200),
  content: z.string().trim().min(FORUM_DETAIL_MIN, `Details need at least ${FORUM_DETAIL_MIN} characters`).max(10000),
  mode: ForumThreadModeSchema.default("learning"),
  sensitiveDataConfirmed: z.literal(true, {
    errorMap: () => ({ message: "Confirm that you removed passwords, keys and customer data" }),
  }),
});
export type CreateForumThreadDto = z.infer<typeof CreateForumThreadSchema>;

export const CreateForumReplySchema = z.object({
  content: z.string().min(1).max(10000),
  parentReplyId: z.string().uuid().optional(),
});
export type CreateForumReplyDto = z.infer<typeof CreateForumReplySchema>;

export const ForumThreadListQuerySchema = PaginationQuerySchema.extend({
  categoryId: z.string().uuid().optional(),
  search: z.string().optional(),
  mode: ForumThreadModeSchema.optional(),
});
export type ForumThreadListQuery = z.infer<typeof ForumThreadListQuerySchema>;

export const UpdateForumThreadSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).max(10000).optional(),
});
export type UpdateForumThreadDto = z.infer<typeof UpdateForumThreadSchema>;

/** A moderator acting on someone else's content must say why; the reason goes to the audit log. */
export const ForumReasonSchema = z.object({
  reason: z.string().trim().min(FORUM_REASON_MIN, `Give a reason of at least ${FORUM_REASON_MIN} characters`).max(FORUM_REASON_MAX),
});
export type ForumReasonDto = z.infer<typeof ForumReasonSchema>;
/** Same body, reason optional (the owner of the content needs none). */
export const ForumOptionalReasonSchema = z.object({ reason: ForumReasonSchema.shape.reason.optional() });
export type ForumOptionalReasonDto = z.infer<typeof ForumOptionalReasonSchema>;

// ---- reports (PRD-025, PRD-028, API-023) ----------------------------------------------------------
export const FORUM_REPORT_REASONS = ["spam", "off_topic", "harassment", "sensitive_data", "assessment_answers", "other"] as const;
export const ForumReportReasonSchema = z.enum(FORUM_REPORT_REASONS);
export type ForumReportReason = z.infer<typeof ForumReportReasonSchema>;
export const FORUM_REPORT_REASON_LABELS: Record<ForumReportReason, string> = {
  spam: "Spam or advertising",
  off_topic: "Off topic",
  harassment: "Harassment or discrimination",
  sensitive_data: "Passwords, keys or customer data",
  assessment_answers: "Copied assessment answers",
  other: "Something else",
};
/** Document 1, section 10.4: exposed credentials and harassment are answered within 4 hours, the rest within 24. */
export const FORUM_URGENT_REASONS: readonly ForumReportReason[] = ["harassment", "sensitive_data"];
/** Open question (not in the documents): one member may file this many reports per day. */
export const FORUM_REPORTS_PER_DAY = 10;

export const CreateForumReportSchema = z.object({
  reason: ForumReportReasonSchema,
  details: z.string().trim().max(1000).optional(),
});
export type CreateForumReportDto = z.infer<typeof CreateForumReportSchema>;

export const FORUM_REPORT_STATUSES = ["open", "dismissed", "removed"] as const;
export const ForumReportStatusSchema = z.enum(FORUM_REPORT_STATUSES);
export type ForumReportStatus = z.infer<typeof ForumReportStatusSchema>;

export const ForumReportListQuerySchema = PaginationQuerySchema.extend({
  status: ForumReportStatusSchema.default("open"),
});
export type ForumReportListQuery = z.infer<typeof ForumReportListQuerySchema>;

// ---- guidelines (PRD-054, DB-030) -----------------------------------------------------------------
export const PublishForumGuidelinesSchema = z.object({
  body: z.string().trim().min(50).max(20000),
  reason: ForumReasonSchema.shape.reason,
});
export type PublishForumGuidelinesDto = z.infer<typeof PublishForumGuidelinesSchema>;

export interface ForumGuidelinesView {
  version: number;
  body: string;
  publishedAt: string;
}
export interface ForumGuidelinesStatus {
  current: ForumGuidelinesView;
  /** Newest version the member accepted, or null when they never accepted any. */
  acceptedVersion: number | null;
  acceptedAt: string | null;
  /** True when the member has never accepted: they must before the first post. */
  mustAccept: boolean;
}

// ---- reputation (PRD-026) -------------------------------------------------------------------------
/** Open question: point values are defaults the community lead can change here. */
export const REPUTATION_POINTS = { answerAccepted: 15, helpfulVote: 2, postRemoved: -10 } as const;
/** Open question: a member can earn at most this many helpful-vote points a day, so votes cannot be farmed. */
export const REPUTATION_HELPFUL_DAILY_CAP = 20;
/** Open question: one voter can give a member at most this many helpful votes in 30 days. */
export const REPUTATION_VOTER_PAIR_CAP = 3;

export interface ForumReputation {
  userId: string;
  points: number;
  /** Text, so a screen never relies on colour alone. */
  level: "New" | "Contributor" | "Trusted" | "Expert";
  acceptedAnswers: number;
}
export const reputationLevel = (points: number): ForumReputation["level"] =>
  points >= 500 ? "Expert" : points >= 100 ? "Trusted" : points >= 20 ? "Contributor" : "New";
