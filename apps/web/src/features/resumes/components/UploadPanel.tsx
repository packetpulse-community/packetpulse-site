"use client";

import { useId, useRef } from "react";
import { FileUp } from "lucide-react";
import { RESUME_ACCEPT_ATTRIBUTE, RESUME_MAX_BYTES } from "@packetpulse/types";
import { Button } from "@/shared/ui/primitives/Button";
import { FeatureOffState } from "@/features/feature-flags/components/FeatureOffState";
import { formatBytes, type UploadPhase } from "../lib/resume-logic";

interface UploadPanelProps {
  phase: UploadPhase;
  /** Inline error from the last attempt (file check, upload, or server). */
  error: string | null;
  /** The resumes.upload switch. Off: no new upload, everything already uploaded stays. */
  enabled: boolean;
  /** The resume_sharing consent is granted: needed before the first upload. */
  consentGranted: boolean;
  hasCurrent: boolean;
  agreeing: boolean;
  consentError: string | null;
  onFile: (file: File) => void;
  onCancel: () => void;
  onAgree: () => void;
}

// Choose a file, see it upload (a real progress bar), see it being checked. A select-a-file button
// instead of a drop zone only: it works with a keyboard and a screen reader, and dropping a file on
// it is not required.
export function UploadPanel({ phase, error, enabled, consentGranted, hasCurrent, agreeing, consentError, onFile, onCancel, onAgree }: UploadPanelProps) {
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const errorId = `${id}-error`;
  const busy = phase.kind !== "idle";

  if (!enabled) {
    return (
      <FeatureOffState
        feature="Resume upload"
        stillWorks="Your resume and its suggestions stay as they are, and you can still open or delete them."
        backHref="/profile"
        backLabel="Back to your profile"
      />
    );
  }

  if (!consentGranted) {
    return (
      <div className="flex flex-col gap-3 rounded-grove-card border border-border bg-surface-subtle p-4">
        <h3 className="font-medium">Before you upload</h3>
        <p className="text-sm">
          Your resume stays private. Only you, and the PacketPulse team while this is on, can open it. Please agree to share it with PacketPulse reviewers to continue. You can withdraw this at any time in your privacy settings: you keep your resume, and the team can no longer open it.
        </p>
        <div>
          <Button onClick={onAgree} loading={agreeing} disabled={agreeing}>
            I agree, continue
          </Button>
        </div>
        {consentError && (
          <p role="alert" className="text-sm text-danger">
            {consentError}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={input}
        id={`${id}-file`}
        type="file"
        hidden
        accept={RESUME_ACCEPT_ATTRIBUTE}
        aria-label="Resume file"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = ""; // choosing the same file again must still fire
          if (file) onFile(file);
        }}
      />
      {phase.kind === "uploading" && (
        <div role="status" className="flex flex-col gap-2">
          <p className="text-sm">
            Uploading <span className="font-medium">{phase.name}</span>… {phase.percent}%
          </p>
          <progress className="h-2 w-full" max={100} value={phase.percent} aria-label={`Uploading ${phase.name}`} />
          <div>
            <Button variant="outline" size="sm" onClick={onCancel}>
              Cancel upload
            </Button>
          </div>
        </div>
      )}
      {phase.kind === "scanning" && (
        <p role="status" className="text-sm">
          Checking <span className="font-medium">{phase.name}</span>… This takes a few seconds.
        </p>
      )}
      {!busy && (
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => input.current?.click()} aria-describedby={error ? errorId : undefined}>
            <FileUp aria-hidden="true" className="h-4 w-4" />
            {hasCurrent ? "Replace my resume" : "Choose a resume"}
          </Button>
          <p className="text-sm text-text-secondary">PDF or Word (.docx), up to {formatBytes(RESUME_MAX_BYTES)}.</p>
        </div>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
