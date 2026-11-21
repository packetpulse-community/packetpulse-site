import { ExternalLink, FileText, RefreshCw, Trash2 } from "lucide-react";
import type { ResumeView } from "@packetpulse/types";
import { Button } from "@/shared/ui/primitives/Button";
import { StatusChip } from "@/shared/ui/primitives/StatusChip";
import { formatBytes, formatUploaded, resumeState } from "../lib/resume-logic";

interface CurrentResumeProps {
  resume: ResumeView;
  busy: "open" | "retry" | "delete" | null;
  /** Re-reading is a new job, so it follows the resumes.upload switch. */
  canRetry: boolean;
  error: string | null;
  onOpen: () => void;
  onRetry: () => void;
  onDelete: () => void;
}

// The current resume: its name, version, the state in words, and what the member can do with it.
export function CurrentResume({ resume, busy, canRetry, error, onOpen, onRetry, onDelete }: CurrentResumeProps) {
  const state = resumeState(resume);
  const openable = resume.status === "ready" || resume.status === "failed" || resume.status === "parsing";
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start gap-3">
        <FileText aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-text-secondary" />
        <div className="min-w-0 flex-1">
          <p className="break-words font-medium">{resume.originalName}</p>
          <p className="text-sm text-text-secondary">
            Version {resume.version} · {formatBytes(resume.sizeBytes)} · uploaded {formatUploaded(resume.createdAt)} · private to you
          </p>
        </div>
      </div>
      <div role="status" aria-live="polite" className="flex flex-col gap-1.5">
        <div>
          <StatusChip tone={state.tone}>{state.label}</StatusChip>
        </div>
        <p className="text-sm">{state.text}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {openable && (
          <Button variant="secondary" onClick={onOpen} loading={busy === "open"} disabled={busy !== null}>
            <ExternalLink aria-hidden="true" className="h-4 w-4" />
            Open my resume
          </Button>
        )}
        {resume.retryable && canRetry && (
          <Button variant="secondary" onClick={onRetry} loading={busy === "retry"} disabled={busy !== null}>
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            Read it again
          </Button>
        )}
        <Button variant="outline" onClick={onDelete} disabled={busy !== null}>
          <Trash2 aria-hidden="true" className="h-4 w-4" />
          Delete my resume
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
