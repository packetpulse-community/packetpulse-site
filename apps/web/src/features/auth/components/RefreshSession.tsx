"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { refreshSession } from "@/shared/api/http-client";
import { loginUrlFor, safeNext } from "@/shared/auth/safe-next";

export function RefreshSession() {
  const params = useSearchParams();

  useEffect(() => {
    // Same-site paths only (shared/auth/safe-next) — ?next= can never be an open redirect.
    const requested = params.get("next");
    const next = safeNext(requested);
    refreshSession().then((ok) => {
      // Full navigation (not router.push) so the next page's server render sees
      // the freshly set cookies.
      window.location.replace(ok ? next : loginUrlFor(requested));
    });
  }, [params]);

  return (
    <div className="flex min-h-screen items-center justify-center gap-3 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" />
      Restoring your session…
    </div>
  );
}
