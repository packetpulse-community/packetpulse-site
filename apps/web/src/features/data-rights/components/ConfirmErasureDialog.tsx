"use client";

import { useId, useState } from "react";
import { Button } from "@/shared/ui/primitives/Button";
import { Dialog } from "@/shared/ui/primitives/Dialog";

interface ConfirmErasureDialogProps {
  open: boolean;
  onClose: () => void;
  graceDays: number;
  pending: boolean;
  /** Inline error from the server (wrong password) or null. */
  error: string | null;
  onConfirm: (password: string) => void;
}

// Password re-entry (SCR-038). The error sits under the field and is tied to it with
// aria-describedby, so it is read when the field is focused as well as announced when it appears.
export function ConfirmErasureDialog({ open, onClose, graceDays, pending, error, onConfirm }: ConfirmErasureDialogProps) {
  const [password, setPassword] = useState("");
  const id = useId();
  const errorId = `${id}-error`;

  function close() {
    setPassword("");
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      destructive
      title="Delete your account?"
      description={`Your account is deactivated now and erased after ${graceDays} days. You can cancel any time before then.`}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (password && !pending) onConfirm(password);
        }}
        className="flex flex-col gap-2"
      >
        <label htmlFor={`${id}-password`} className="text-sm font-medium">
          Enter your password to confirm
        </label>
        <input
          id={`${id}-password`}
          type="password"
          autoComplete="current-password"
          className="rounded-md border border-input bg-background px-3 py-2.5"
          value={password}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && (
          <p id={errorId} role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={close} disabled={pending}>
            Keep my account
          </Button>
          <Button type="submit" variant="destructive" loading={pending} disabled={!password}>
            Schedule deletion
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
