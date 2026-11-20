import { redirect } from "next/navigation";
import { getCurrentUser } from "@/shared/auth/session";
import { NotificationPreferencesForm } from "@/features/notifications/components/NotificationPreferencesForm";

export const metadata = { title: "Notification settings" };

// SCR-037
export default async function NotificationSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Notification settings</h1>
        <p className="text-muted-foreground">Choose how PacketPulse reaches you. Everything always appears in the app.</p>
      </div>
      <NotificationPreferencesForm />
    </div>
  );
}
