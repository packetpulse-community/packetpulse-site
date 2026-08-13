"use client";

import Link from "next/link";
import { useAuth } from "@/shared/auth/AuthProvider";
import { authApi } from "@/features/auth/api/auth.api";
import { useRouter } from "next/navigation";

// Compact top bar carrying only global, always-relevant items — no persistent
// nested sidebar tree (plan §6 domain-driven navigation). Domain hub links live
// here for now; the full command-palette (cmdk) cross-domain search is follow-up
// work layered on top of this same shell.
export function WorkflowShell({ children }: { children: React.ReactNode }) {
  const user = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await authApi.logout();
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="floating-nav sticky top-4 z-40 flex items-center justify-between px-4 py-3">
        <Link href="/dashboard" className="font-semibold">
          PacketPulse
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/blogs" className="hover:text-primary">
            Blogs
          </Link>
          <Link href="/resources" className="hover:text-primary">
            Resources
          </Link>
          <Link href="/recordings" className="hover:text-primary">
            Recordings
          </Link>
          {user && (
            <>
              <span className="text-muted-foreground">{user.firstName}</span>
              <button onClick={handleLogout} className="text-muted-foreground hover:text-destructive">
                Log out
              </button>
            </>
          )}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
