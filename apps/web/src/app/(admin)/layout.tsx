import { getCurrentUser } from "@/shared/auth/session";
import { redirectToLogin } from "@/shared/auth/redirect-to-login";
import { AuthProvider } from "@/shared/auth/AuthProvider";
import { navigationFor, NO_ACCESS_DESTINATION } from "@/shared/config/navigation";
import { NoAccessScreen } from "@/shared/components/NoAccessScreen";
import { WorkflowShell } from "@/shared/layouts/WorkflowShell";
import { AdminShell } from "@/features/admin/components/AdminShell";

// Contextual left rail scoped ONLY to /admin routes. Who may enter comes from the same
// navigation model as every menu: admins get everything, a moderator gets the
// moderation lists their permissions open. Everyone else — instead of a silent
// redirect — gets the plain "no access" screen inside the normal app shell, with a
// way back (Document 3 §2.2, SCR-043). Each page is checked again per path in
// AdminShell, and the server refuses every request regardless.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) return redirectToLogin();

  if (navigationFor(user).admin.length === 0) {
    return (
      <AuthProvider user={user}>
        <WorkflowShell>
          <NoAccessScreen mode="embedded" destination={NO_ACCESS_DESTINATION} />
        </WorkflowShell>
      </AuthProvider>
    );
  }

  return (
    <AuthProvider user={user}>
      <AdminShell user={user}>{children}</AdminShell>
    </AuthProvider>
  );
}
