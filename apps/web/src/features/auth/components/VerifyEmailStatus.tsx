"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { authApi } from "../api/auth.api";
import { ApiError } from "@/shared/api/http-client";
import { cn } from "@/shared/utils/cn";
import { buttonVariants } from "@/shared/ui/primitives/Button";

function errorMessage(err: unknown, fallback: string) {
  return err instanceof ApiError ? ((err.body as { message?: string })?.message ?? fallback) : fallback;
}

type Status = "verifying" | "success" | "error";

export function VerifyEmailStatus({ token }: { token: string | null }) {
  const [status, setStatus] = useState<Status>(token ? "verifying" : "error");
  const [message, setMessage] = useState("This verification link is missing a token.");

  useEffect(() => {
    if (!token) return;
    authApi
      .verifyEmail(token)
      .then(() => setStatus("success"))
      .catch((err) => {
        setStatus("error");
        setMessage(errorMessage(err, "This verification link is invalid or has expired."));
      });
  }, [token]);

  if (status === "verifying") {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground">Verifying your email…</p>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <CheckCircle2 className="h-10 w-10 text-emerald-500" />
        <h1 className="text-xl font-semibold">Email verified</h1>
        <p className="text-muted-foreground">Your email is now verified.</p>
        <Link href="/dashboard" className={cn(buttonVariants({ variant: "gradient" }), "w-full")}>
          Go to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <XCircle className="h-10 w-10 text-destructive" />
      <h1 className="text-xl font-semibold">Verification failed</h1>
      <p className="text-muted-foreground">{message}</p>
      <Link href="/dashboard" className={cn(buttonVariants({ variant: "gradient" }), "w-full")}>
        Go to dashboard
      </Link>
    </div>
  );
}
