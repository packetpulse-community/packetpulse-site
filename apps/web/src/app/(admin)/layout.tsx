import { redirect } from "next/navigation";
import { getCurrentUser } from "@/shared/auth/session";
import { AuthProvider } from "@/shared/auth/AuthProvider";
import { AdminShell } from "@/features/admin/components/AdminShell";

// Contextual left rail scoped ONLY to /admin routes — the general end-user
// experience never shows a persistent sidebar (plan §6); this is deliberately
// the one exception, since admin moderation is a distinct, dense workflow.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.roles.includes("admin") && !user.roles.includes("super_admin")) redirect("/dashboard");

  return (
    <AuthProvider user={user}>
      <AdminShell user={user}>{children}</AdminShell>
    </AuthProvider>
  );
}
