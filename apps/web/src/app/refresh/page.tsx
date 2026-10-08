import { Suspense } from "react";
import { RefreshSession } from "@/features/auth/components/RefreshSession";

// Landing spot for proxy.ts when the 15-minute access cookie has lapsed but the
// visitor is still signed in — renews the session and sends them back.
export default function RefreshPage() {
  return (
    <Suspense>
      <RefreshSession />
    </Suspense>
  );
}
