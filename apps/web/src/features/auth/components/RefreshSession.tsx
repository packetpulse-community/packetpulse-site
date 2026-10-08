"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { refreshSession } from "@/shared/api/http-client";

// Only same-site paths — never an absolute or protocol-relative URL — so ?next=
// can't be used as an open redirect.
function safeNext(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

export function RefreshSession() {
  const params = useSearchParams();

  useEffect(() => {
    const next = safeNext(params.get("next"));
    refreshSession().then((ok) => {
      // Full navigation (not router.push) so the next page's server render sees
      // the freshly set cookies.
      window.location.replace(ok ? next : "/login");
    });
  }, [params]);

  return (
    <div className="flex min-h-screen items-center justify-center gap-3 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" />
      Restoring your session…
    </div>
  );
}
