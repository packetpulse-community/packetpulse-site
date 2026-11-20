"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSessionHint } from "./session-hint";
import { SIGNED_IN_HOME, shouldShowSignedInBanner } from "./session-aware";
import { buttonVariants } from "@/shared/ui/primitives/Button";
import { cn } from "@/shared/utils/cn";

// Shown above the sign-in, register and forgot-password forms when the browser looks signed in.
// It never redirects: the presence cookie can be stale (a timed-out session), and an automatic
// redirect would loop dashboard -> refresh -> login. The form below stays fully usable.
export function SessionAwareBanner() {
  const hint = useSessionHint();
  const pathname = usePathname();
  if (!shouldShowSignedInBanner(hint, pathname)) return null;
  return (
    <div role="status" className="mb-6 flex flex-col gap-3 rounded-grove-card border border-border bg-surface-subtle p-4 text-center">
      <p className="text-sm font-medium text-foreground">You are already signed in</p>
      <Link href={SIGNED_IN_HOME} className={cn(buttonVariants({ variant: "gradient" }), "w-full")}>
        Continue to your dashboard
      </Link>
    </div>
  );
}
