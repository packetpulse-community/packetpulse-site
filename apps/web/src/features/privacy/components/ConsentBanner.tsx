"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/primitives/Alert";
import { buttonVariants } from "@/shared/ui/primitives/Button";
import { cn } from "@/shared/utils/cn";
import { privacyApi, privacyKeys } from "../api/privacy.api";
import { useAuth } from "@/shared/auth/AuthProvider";

// Asks the member to re-accept a required policy when its version changed (TASK-025). It informs
// and links to the consent centre; it never blocks the page. Quiet when everything is current or
// when the request fails (the consent centre shows its own error).
export function ConsentBanner() {
  const user = useAuth();
  const pathname = usePathname();
  const { data } = useQuery({
    queryKey: privacyKeys.consents,
    queryFn: privacyApi.myConsents,
    enabled: !!user,
    retry: false,
    staleTime: 5 * 60_000,
  });
  // The consent centre is where the member answers, so the banner steps aside there.
  if (!data?.needsAction || pathname.startsWith("/settings/privacy")) return null;
  const names = data.items.filter((i) => i.needsAction).map((i) => i.label);

  return (
    <Alert variant="grove-warning">
      <AlertTitle>Please review our updated policies</AlertTitle>
      <AlertDescription>
        The {names.join(" and the ")} {names.length > 1 ? "have" : "has"} changed. Read {names.length > 1 ? "them" : "it"} and accept to keep your consent record up to date.
      </AlertDescription>
      <Link href="/settings/privacy#consent" className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "mt-3")}>
        Review and accept
      </Link>
    </Alert>
  );
}
