"use client";

import { Button } from "@/shared/ui/primitives/Button";
import { Dialog } from "@/shared/ui/primitives/Dialog";

interface Props {
  open: boolean;
  /** "your resume" or "version 2". */
  what: string;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}

// Names the effect of the action (DES-012): the file and its suggestions go; what the member already
// accepted stays on the profile.
export function DeleteResumeDialog({ open, what, pending, error, onClose, onConfirm }: Props) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      destructive
      title={`Delete ${what}?`}
      description="The file is removed from our storage and the suggestions we read from it are deleted. Skills and details you already accepted stay on your profile."
    >
      {error && (
        <p role="alert" className="mb-3 text-sm text-danger">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
          Keep it
        </Button>
        <Button type="button" variant="destructive" onClick={onConfirm} loading={pending}>
          Delete
        </Button>
      </div>
    </Dialog>
  );
}
