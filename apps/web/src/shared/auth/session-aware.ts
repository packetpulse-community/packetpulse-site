import type { SessionHint } from "./session-hint";

// Pure decision logic for UI that changes with the session hint (no React, no network).
// The hint is a UI hint only, never access control.

export interface SessionAction {
  href: string;
  label: string;
}

export interface SessionAwareActions {
  signedOut: SessionAction;
  // null = hide this call to action for signed-in visitors (it makes no sense for them).
  signedIn: SessionAction | null;
}

export type ResolvedSessionAction =
  | { kind: "placeholder" }
  | { kind: "hidden" }
  | ({ kind: "link" } & SessionAction);

export function resolveSessionAction(hint: SessionHint, actions: SessionAwareActions): ResolvedSessionAction {
  if (hint === "unknown") return { kind: "placeholder" };
  if (hint === "signed-in") {
    return actions.signedIn ? { kind: "link", ...actions.signedIn } : { kind: "hidden" };
  }
  return { kind: "link", ...actions.signedOut };
}

// Where "Continue" goes from the sign-in pages.
export const SIGNED_IN_HOME = "/dashboard";

// Pages that show the "already signed in" banner (verify-email is deliberately not one).
const BANNER_PATHS = ["/login", "/register", "/forgot-password"];

export function shouldShowSignedInBanner(hint: SessionHint, pathname: string): boolean {
  return hint === "signed-in" && BANNER_PATHS.includes(pathname);
}
