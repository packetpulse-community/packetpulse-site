"use client";

import { useEffect, useId, useState } from "react";
import { FORUM_REPORT_REASONS, FORUM_REPORT_REASON_LABELS, type ForumReportReason } from "@packetpulse/types";
import { Button } from "@/shared/ui/primitives/Button";
import { Dialog } from "@/shared/ui/primitives/Dialog";
import { forumErrorMessage } from "../api/forums.api";

interface ReportDialogProps {
  open: boolean;
  onClose: () => void;
  what: "thread" | "reply";
  onSubmit: (dto: { reason: ForumReportReason; details?: string }) => Promise<unknown>;
}

// A member reports a post with a reason (PRD-025). Errors such as "already reported" or the daily
// limit are shown inside the dialog in the server's own words.
export function ReportDialog({ open, onClose, what, onSubmit }: ReportDialogProps) {
  const id = useId();
  const [reason, setReason] = useState<ForumReportReason | "">("");
  const [details, setDetails] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setReason("");
      setDetails("");
      setError(null);
      setSent(false);
    }
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason) {
      setError("Choose what is wrong with this post.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit({ reason, details: details.trim() || undefined });
      setSent(true);
    } catch (err) {
      setError(forumErrorMessage(err, "Could not send the report. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={`Report this ${what}`} description="A moderator reviews every report. Reports about passwords, keys or harassment are answered first.">
      {sent ? (
        <div className="flex flex-col gap-3">
          <p role="status">✓ Thank you. The moderators will review your report.</p>
          <Button onClick={onClose}>Close</Button>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="flex flex-col gap-3">
          <fieldset className="flex flex-col gap-2" aria-describedby={error ? `${id}-error` : undefined}>
            <legend className="text-sm font-medium">What is wrong?</legend>
            {FORUM_REPORT_REASONS.map((r) => (
              <label key={r} className="flex items-center gap-2 text-sm">
                <input type="radio" name={`${id}-reason`} value={r} checked={reason === r} onChange={() => setReason(r)} />
                {FORUM_REPORT_REASON_LABELS[r]}
              </label>
            ))}
          </fieldset>
          <label htmlFor={`${id}-details`} className="text-sm font-medium">
            More detail (optional)
          </label>
          <textarea
            id={`${id}-details`}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            maxLength={1000}
            rows={3}
            className="rounded-md border border-input bg-background px-3 py-2"
          />
          {error && (
            <p id={`${id}-error`} role="alert" className="text-sm text-danger">
              ⚠ {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Sending…" : "Send report"}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
