"use client";

import { useSyncExternalStore } from "react";

// A cheap, instant "does this browser look signed in?" hint for pages that are statically
// prerendered and so cannot read the session on the server (home, about, tools, blogs...).
//
// It reads the non-httpOnly `session_active` presence cookie the backend sets at sign-in
// (apps/backend .../auth-cookie.service.ts). It is a UI hint only, never used for access
// control: the real session lives in httpOnly cookies and every request is still checked on
// the server. If the hint is stale (for example a staff session that timed out), the
// "Dashboard" link simply sends the visitor through the normal sign-in flow.

export type SessionHint = "unknown" | "signed-in" | "signed-out";

export function readSessionHint(cookieString: string): Exclude<SessionHint, "unknown"> {
  return /(?:^|;\s*)session_active=true(?:;|$)/.test(cookieString) ? "signed-in" : "signed-out";
}

function subscribe(onChange: () => void) {
  // Sign in or out in another tab, or coming back to a cached page, changes the cookie
  // without a navigation here, so re-read when the page becomes visible or focused again.
  window.addEventListener("focus", onChange);
  window.addEventListener("pageshow", onChange);
  document.addEventListener("visibilitychange", onChange);
  return () => {
    window.removeEventListener("focus", onChange);
    window.removeEventListener("pageshow", onChange);
    document.removeEventListener("visibilitychange", onChange);
  };
}

// "unknown" on the server and during hydration, so the prerendered HTML never claims the
// wrong state; callers should render a same-size placeholder rather than "Sign In" then.
export function useSessionHint(): SessionHint {
  return useSyncExternalStore(
    subscribe,
    () => readSessionHint(document.cookie),
    () => "unknown",
  );
}
