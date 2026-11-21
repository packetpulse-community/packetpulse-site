import type { Resume, ResumeSuggestion, StoredFile } from "@prisma/client";
import { RESUME_FAILURE_MESSAGES, RESUME_RETRYABLE } from "@packetpulse/types";
import type { ResumeFailureCode, ResumeSuggestionView, ResumeView } from "@packetpulse/types";
import { CURRENT_SLOT } from "./resumes.constants";

type ResumeWithFile = Resume & { file: Pick<StoredFile, "originalName" | "contentType" | "sizeBytes"> };

const isFailureCode = (c: string | null): c is ResumeFailureCode => !!c && c in RESUME_FAILURE_MESSAGES;

export function toResumeView(r: ResumeWithFile): ResumeView {
  const code = isFailureCode(r.failureCode) ? r.failureCode : r.failureCode ? "failed" : null;
  return {
    id: r.id,
    version: r.version,
    fileId: r.fileId,
    originalName: r.file.originalName,
    contentType: r.file.contentType,
    sizeBytes: r.file.sizeBytes,
    status: r.status,
    failureCode: code,
    failureMessage: code && (r.status === "failed" || r.status === "rejected") ? RESUME_FAILURE_MESSAGES[code] : null,
    retryable: r.status === "failed" && code !== null && RESUME_RETRYABLE.includes(code),
    isCurrent: r.activeSlot === CURRENT_SLOT,
    visibility: "private",
    createdAt: r.createdAt.toISOString(),
    parsedAt: r.parsedAt?.toISOString() ?? null,
  };
}

export function toSuggestionView(s: ResumeSuggestion): ResumeSuggestionView {
  return { id: s.id, kind: s.kind, status: s.status, data: s.data, decidedAt: s.decidedAt?.toISOString() ?? null } as unknown as ResumeSuggestionView;
}
