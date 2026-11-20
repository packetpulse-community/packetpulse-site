import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/shared/auth/session";
import { NotificationsList } from "@/features/notifications/components/NotificationsList";

export const metadata = { title: "Notifications" };

// SCR-013
export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Notifications</h1>
        <p className="text-muted-foreground">
          What happened on your account and content.{" "}
          <Link href="/settings/notifications" className="text-indigo-600 underline-offset-4 hover:underline dark:text-indigo-400">
            Change what you get by email
          </Link>
          .
        </p>
      </div>
      <NotificationsList />
    </div>
  );
}
