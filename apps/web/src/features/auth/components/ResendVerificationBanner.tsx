"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Mail, X } from "lucide-react";
import { authApi } from "../api/auth.api";
import { useAuth } from "@/shared/auth/AuthProvider";
import { Button } from "@/shared/ui/primitives/Button";

export function ResendVerificationBanner() {
  const user = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [sent, setSent] = useState(false);

  const mutation = useMutation({
    mutationFn: authApi.resendVerification,
    onSuccess: () => setSent(true),
  });

  if (!user || user.emailVerified || dismissed) return null;

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
      <div className="flex items-center gap-2">
        <Mail className="h-4 w-4 shrink-0 text-amber-600" />
        <span>
          {sent ? "Verification email sent — check your inbox." : "Please verify your email address."}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {!sent && (
          <Button variant="outline" size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? "Sending…" : "Resend email"}
          </Button>
        )}
        <button onClick={() => setDismissed(true)} className="text-muted-foreground hover:text-foreground" aria-label="Dismiss">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
