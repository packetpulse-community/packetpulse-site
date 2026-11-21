import { redirect } from "next/navigation";
import { getCurrentUser } from "@/shared/auth/session";
import { ProfileVisibilityForm } from "@/features/privacy/components/ProfileVisibilityForm";
import { ConsentCentre } from "@/features/privacy/components/ConsentCentre";

export const metadata = { title: "Privacy and consent" };

// SCR-012 (privacy) and SCR-038 (consent): who sees your profile, your consents and their history.
export default async function PrivacySettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Privacy and consent</h1>
        <p className="text-muted-foreground">Decide who can see your profile and keep track of what you have agreed to.</p>
      </div>
      <ProfileVisibilityForm />
      <ConsentCentre />
    </div>
  );
}
