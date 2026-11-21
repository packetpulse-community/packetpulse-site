"use client";

import { useEffect, useId, useState } from "react";
import { FORUM_REASON_MAX, FORUM_REASON_MIN } from "@packetpulse/types";
import { Button } from "@/shared/ui/primitives/Button";
import { Dialog } from "@/shared/ui/primitives/Dialog";
import { forumErrorMessage } from "../api/forums.api";

interface ReasonDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  confirmLabel: string;
  /** Moderator actions need a reason (PRD-028); the author of the content is told it. */
  onConfirm: (reason: string) => Promise<unknown>;
  destructive?: boolean;
}

// One dialog for every moderator action that needs a written reason. The error stays inside the
// dialog, tied to the field, so the person never loses what they typed.
export function ReasonDialog({ open, onClose, title, description, confirmLabel, onConfirm, destructive = false }: ReasonDialogProps) {
  const id = useId();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setReason("");
      setError(null);
    }
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = reason.trim();
    if (text.length < FORUM_REASON_MIN) {
      setError(`Give a reason of at least ${FORUM_REASON_MIN} characters.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onConfirm(text);
      onClose();
    } catch (err) {
      setError(forumErrorMessage(err, "Could not save. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={title} description={description} destructive={destructive}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-3">
        <label htmlFor={`${id}-reason`} className="text-sm font-medium">
          Reason (recorded in the audit log)
        </label>
        <textarea
          id={`${id}-reason`}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={FORUM_REASON_MAX}
          rows={3}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
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
          <Button type="submit" variant={destructive ? "destructive" : "default"} disabled={busy}>
            {busy ? "Saving…" : confirmLabel}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
