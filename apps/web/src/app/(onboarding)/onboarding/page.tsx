import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/shared/auth/session";
import { redirectToLogin } from "@/shared/auth/redirect-to-login";
import { safeNext } from "@/shared/auth/safe-next";
import { AuthProvider } from "@/shared/auth/AuthProvider";
import { onboardingServerApi } from "@/features/onboarding/api/onboarding.api";
import { OnboardingFlow } from "@/features/onboarding/components/OnboardingFlow";
import { skillsServerApi } from "@/features/skills/api/skills.api";

interface OnboardingPageProps {
  searchParams: Promise<{ next?: string }>;
}

// First sign-in lands here until the required details (PRD-003) are complete. Resumable: the
// status comes from the server, so a member who left halfway continues where they stopped.
export default async function OnboardingPage({ searchParams }: OnboardingPageProps) {
  const { next } = await searchParams;
  const user = await getCurrentUser();
  if (!user) return redirectToLogin();

  const cookieHeader = (await cookies()).toString();
  const status = await onboardingServerApi.status(cookieHeader);
  if (status.complete) redirect(safeNext(next));

  const [taxonomy, mine] = await Promise.all([skillsServerApi.taxonomy(), skillsServerApi.mine(cookieHeader)]);
  return (
    <AuthProvider user={user}>
      <OnboardingFlow initial={status} taxonomy={taxonomy.skills} initialSkills={mine} next={next ?? null} />
    </AuthProvider>
  );
}
