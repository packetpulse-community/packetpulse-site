import { sanitizeNextPath } from "@/shared/auth/safe-next";

// TASK-023: a member whose required details are incomplete is sent to /onboarding from every
// member page, with the page they asked for kept in ?next= so they land there afterwards (and a
// /login?next= deep link survives the detour). Staff accounts are never routed: they are created
// by an admin or the secret-code route and have no member profile to complete.
const STAFF_ROLES = ["admin", "super_admin"];

export function needsOnboarding(user: { onboardingComplete: boolean; roles: readonly string[] }): boolean {
  if (user.onboardingComplete) return false;
  return !user.roles.some((role) => STAFF_ROLES.includes(role));
}

/** /onboarding, carrying the requested path when it is a safe same-site path. */
export function onboardingUrlFor(requestedPath: string | null | undefined): string {
  const next = sanitizeNextPath(requestedPath);
  return next ? `/onboarding?next=${encodeURIComponent(next)}` : "/onboarding";
}
