import { getCurrentUser } from "@/shared/auth/session";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { redirectToLogin } from "@/shared/auth/redirect-to-login";
import { needsOnboarding, onboardingUrlFor } from "@/features/onboarding/lib/onboarding-guard";
import { AuthProvider } from "@/shared/auth/AuthProvider";
import { WorkflowShell } from "@/shared/layouts/WorkflowShell";

// Server-side auth enforcement — resolves the user against the httpOnly cookie
// (not a client-side redirect-after-flash) before anything renders (plan §6).
export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) return redirectToLogin();
  // TASK-023: a member whose required details are incomplete is routed to /onboarding, with the page
  // they asked for kept so they land there afterwards (the /login?next= deep link survives the detour).
  // x-pp-path is set for every page request in proxy.ts and cannot be spoofed by the client.
  if (needsOnboarding(user)) redirect(onboardingUrlFor((await headers()).get("x-pp-path")));

  return (
    <AuthProvider user={user}>
      <WorkflowShell>{children}</WorkflowShell>
    </AuthProvider>
  );
}
