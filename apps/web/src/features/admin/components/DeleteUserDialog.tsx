"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AUDIT_REASON_MIN_LENGTH } from "@packetpulse/types";
import { Dialog } from "@/shared/ui/primitives/Dialog";
import { Button } from "@/shared/ui/primitives/Button";
import { ApiError } from "@/shared/api/http-client";
import { adminClientApi, type AdminUser } from "../api/admin.api";

interface DeleteUserDialogProps {
  user: AdminUser | null;
  onClose: () => void;
}

function backendMessage(err: unknown, fallback: string) {
  if (err instanceof ApiError) {
    const message = (err.body as { message?: string | string[] } | null)?.message;
    if (Array.isArray(message)) return message.join(", ");
    if (message) return message;
  }
  return fallback;
}

export function DeleteUserDialog({ user, onClose }: DeleteUserDialogProps) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Start clean for each user; on a failed call the dialog stays open so the typed reason is kept.
  const userId = user?.id;
  useEffect(() => {
    setReason("");
    setTouched(false);
    setServerError(null);
  }, [userId]);

  const trimmed = reason.trim();
  const tooShort = trimmed.length < AUDIT_REASON_MIN_LENGTH;

  const mutation = useMutation({
    mutationFn: (value: string) => adminClientApi.deleteUser(user!.id, value),
    onSuccess: () => {
      toast.success("User deleted");
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      onClose();
    },
    onError: (err) => setServerError(backendMessage(err, "Failed to delete user")),
  });

  if (!user) return null;

  function submit() {
    setTouched(true);
    setServerError(null);
    if (tooShort) return;
    mutation.mutate(trimmed);
  }

  const showError = touched && tooShort;

  return (
    <Dialog open={!!user} onClose={onClose} title="Delete user" description="This action cannot be undone.">
      <p className="text-sm text-muted-foreground">
        Are you sure you want to permanently delete{" "}
        <span className="font-medium text-foreground">
          {user.firstName} {user.lastName}
        </span>{" "}
        ({user.email})?
      </p>
      <div className="mt-4 flex flex-col gap-1">
        <label htmlFor="delete-user-reason" className="text-sm font-medium">
          Reason for deleting (recorded in the audit log)
        </label>
        <textarea
          id="delete-user-reason"
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          onBlur={() => setTouched(true)}
          aria-invalid={showError}
          aria-describedby="delete-user-reason-error"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <p id="delete-user-reason-error" role={showError ? "alert" : undefined} className="min-h-4 text-sm text-destructive">
          {showError ? `Enter at least ${AUDIT_REASON_MIN_LENGTH} characters explaining why.` : ""}
        </p>
      </div>
      {serverError && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {serverError}
        </p>
      )}
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
          Cancel
        </Button>
        <Button variant="destructive" onClick={submit} disabled={mutation.isPending}>
          {mutation.isPending ? "Deleting…" : "Delete user permanently"}
        </Button>
      </div>
    </Dialog>
  );
}
