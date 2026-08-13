import { redirect } from "next/navigation";
import { getCurrentUser } from "@/shared/auth/session";
import { AuthProvider } from "@/shared/auth/AuthProvider";
import { WorkflowShell } from "@/shared/layouts/WorkflowShell";

// Server-side auth enforcement — resolves the user against the httpOnly cookie
// (not a client-side redirect-after-flash) before anything renders (plan §6).
export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <AuthProvider user={user}>
      <WorkflowShell>{children}</WorkflowShell>
    </AuthProvider>
  );
}
