"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Dialog } from "@/shared/ui/primitives/Dialog";
import { Button } from "@/shared/ui/primitives/Button";
import { profileClientApi } from "../api/profile.api";
import { ApiError } from "@/shared/api/http-client";

const inputClass = "rounded-md border border-input bg-background px-3 py-2.5";

export function DeleteAccountDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => profileClientApi.deleteAccount({ password }),
    onSuccess: () => {
      toast.success("Account deleted");
      router.push("/login");
    },
    onError: (err) => {
      setError(err instanceof ApiError ? ((err.body as { message?: string })?.message ?? "Incorrect password") : "Could not delete your account");
    },
  });

  function handleClose() {
    setPassword("");
    setError(null);
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Delete your account"
      description="This permanently deletes your account and cannot be undone."
    >
      <div className="flex flex-col gap-2">
        <label htmlFor="deleteAccountPassword" className="text-sm font-medium">
          Confirm your password
        </label>
        <input
          id="deleteAccountPassword"
          type="password"
          className={inputClass}
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError(null);
          }}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="outline" onClick={handleClose} disabled={mutation.isPending}>
          Cancel
        </Button>
        <Button
          variant="destructive"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || !password}
        >
          {mutation.isPending ? "Deleting…" : "Delete account"}
        </Button>
      </div>
    </Dialog>
  );
}
