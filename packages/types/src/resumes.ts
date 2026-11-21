import { z } from "zod";
import { FILE_MAX_BYTES } from "./files";

// TASK-024 resume upload and parsing (PRD-007, PRD-046, SCR-012, API-007, DB-005, TEST-004,
// SEC-03). A resume is a private file plus background-parsed SUGGESTIONS. Nothing is written to the
// member's profile until the member accepts it, one field at a time, and a failed parse never
// blocks entering the same details by hand. Values the documents leave open are the constants
// below (listed in docs/ops/resume-parsing.md).

/** PRD-007: "PDF, DOC and DOCX up to 5 MB". Owner decision (task brief): legacy DOC is not accepted. */
export const RESUME_MAX_BYTES = FILE_MAX_BYTES;
export const RESUME_CONTENT_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;
export const RESUME_ACCEPT_ATTRIBUTE = ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
/** The newest versions kept per member (the current one included). Older ones are deleted on replace. Default, not in the docs. */
export const RESUME_MAX_VERSIONS = 5;
/** Parsing gives up after this long (the worker is terminated). Default, not in the docs. */
export const RESUME_PARSE_TIMEOUT_MS = 20_000;
/** Most suggestions of each kind kept from one resume. Default, not in the docs. */
export const RESUME_MAX_SUGGESTIONS = { skill: 40, education: 8, experience: 15 } as const;

export const RESUME_STATUSES = ["awaiting_upload", "parsing", "ready", "failed", "rejected"] as const;
export type ResumeStatus = (typeof RESUME_STATUSES)[number];

/** Why a parse produced nothing. Each has a plain-language message; none exposes a technical cause. */
export const RESUME_FAILURE_CODES = ["unreadable", "password_protected", "no_text", "too_complex", "timeout", "unsafe_content", "failed"] as const;
export type ResumeFailureCode = (typeof RESUME_FAILURE_CODES)[number];

export const RESUME_FAILURE_MESSAGES: Record<ResumeFailureCode, string> = {
  unreadable: "We could not read this file. It may be damaged. You can upload it again, or enter your details by hand.",
  password_protected: "This file is password protected, so we could not read it. Remove the password and upload it again, or enter your details by hand.",
  no_text: "We found no text in this file. It may be a scan or a picture. Upload a version with selectable text, or enter your details by hand.",
  too_complex: "This file is too long or complicated for us to read. Try a shorter version, or enter your details by hand.",
  timeout: "Reading this file took too long. Try again, or enter your details by hand.",
  unsafe_content: "This file contains content we do not accept (such as macros, scripts or embedded files), so we removed it. Save a plain copy and upload that.",
  failed: "We could not read your resume this time. You can try again, or enter your details by hand.",
};

/** Statuses in which the member may press "Try again". */
export const RESUME_RETRYABLE: readonly ResumeFailureCode[] = ["timeout", "failed", "unreadable"];

export const RESUME_SUGGESTION_KINDS = ["skill", "education", "experience"] as const;
export type ResumeSuggestionKind = (typeof RESUME_SUGGESTION_KINDS)[number];

export const RESUME_SUGGESTION_STATUSES = ["pending", "accepted", "rejected"] as const;
export type ResumeSuggestionStatus = (typeof RESUME_SUGGESTION_STATUSES)[number];

/** A taxonomy skill found in the resume. `matchedOn` is the wording the resume used. */
export interface SkillSuggestionData {
  skillId: string;
  name: string;
  matchedOn: string;
}
export interface EducationSuggestionData {
  institution: string | null;
  qualification: string | null;
  startYear: number | null;
  endYear: number | null;
}
export interface ExperienceSuggestionData {
  title: string | null;
  company: string | null;
  /** YYYY-MM */
  startDate: string | null;
  /** YYYY-MM, null when `current` */
  endDate: string | null;
  current: boolean;
}

export type ResumeSuggestionView =
  | { id: string; kind: "skill"; status: ResumeSuggestionStatus; data: SkillSuggestionData; decidedAt: string | null }
  | { id: string; kind: "education"; status: ResumeSuggestionStatus; data: EducationSuggestionData; decidedAt: string | null }
  | { id: string; kind: "experience"; status: ResumeSuggestionStatus; data: ExperienceSuggestionData; decidedAt: string | null };

export interface ResumeView {
  id: string;
  version: number;
  /** The file id, for GET /files/:id/link (the only way to open the file). */
  fileId: string;
  originalName: string;
  contentType: string;
  sizeBytes: number;
  status: ResumeStatus;
  failureCode: ResumeFailureCode | null;
  /** Plain-language explanation when `status` is failed or rejected. */
  failureMessage: string | null;
  retryable: boolean;
  isCurrent: boolean;
  /** Private always: only the member (and permitted staff once the member agreed to sharing) can open it. */
  visibility: "private";
  createdAt: string;
  parsedAt: string | null;
}

export interface ResumeOverview {
  current: ResumeView | null;
  /** Suggestions of the current resume, newest decision state included. */
  suggestions: ResumeSuggestionView[];
  /** Earlier versions, newest first (the current one is not repeated). */
  history: ResumeView[];
  /** The `resume_sharing` consent is granted: needed before the first upload. */
  consentGranted: boolean;
  maxBytes: number;
  maxVersions: number;
}

export interface ResumeUploadStart {
  resume: ResumeView;
  uploadUrl: string;
  method: "PUT";
  expiresInSeconds: number;
}

export const CreateResumeUploadSchema = z.object({
  originalName: z.string().trim().min(1).max(200),
  contentType: z.enum(RESUME_CONTENT_TYPES),
  sizeBytes: z.number().int().positive().max(RESUME_MAX_BYTES),
});
export type CreateResumeUploadDto = z.infer<typeof CreateResumeUploadSchema>;

export const DecideSuggestionSchema = z.object({ decision: z.enum(["accept", "reject"]) });
export type DecideSuggestionDto = z.infer<typeof DecideSuggestionSchema>;

/** What the member accepted from a resume, now on the profile. */
export interface ProfileEducationEntry extends EducationSuggestionData {
  id: string;
  createdAt: string;
}
export interface ProfileExperienceEntry extends ExperienceSuggestionData {
  id: string;
  createdAt: string;
}
export interface ProfileEntries {
  education: ProfileEducationEntry[];
  experience: ProfileExperienceEntry[];
}
