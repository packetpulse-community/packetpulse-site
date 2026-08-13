import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/shared/auth/session";
import { AuthProvider } from "@/shared/auth/AuthProvider";

// Contextual left rail scoped ONLY to /admin routes — the general end-user
// experience never shows a persistent sidebar (plan §6); this is deliberately
// the one exception, since admin moderation is a distinct, dense workflow.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.roles.includes("admin") && !user.roles.includes("super_admin")) redirect("/dashboard");

  return (
    <AuthProvider user={user}>
      <div className="flex min-h-screen bg-background text-foreground">
        <aside className="w-56 shrink-0 border-r border-border p-4">
          <Link href="/dashboard" className="mb-6 block font-semibold">
            ← PacketPulse
          </Link>
          <nav className="flex flex-col gap-1 text-sm">
            <Link href="/admin" className="rounded px-2 py-1.5 hover:bg-accent">
              Overview
            </Link>
            <Link href="/admin/users" className="rounded px-2 py-1.5 hover:bg-accent">
              Users
            </Link>
            <Link href="/admin/resources" className="rounded px-2 py-1.5 hover:bg-accent">
              Resources
            </Link>
            <Link href="/admin/recordings" className="rounded px-2 py-1.5 hover:bg-accent">
              Recordings
            </Link>
            <Link href="/admin/analytics" className="rounded px-2 py-1.5 hover:bg-accent">
              Analytics
            </Link>
          </nav>
        </aside>
        <main className="flex-1 p-8">{children}</main>
      </div>
    </AuthProvider>
  );
}
