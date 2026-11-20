"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Toaster } from "sonner";
import type { SessionUser } from "@/shared/auth/session";
import { canOpenAdminPath, NO_ACCESS_DESTINATION } from "@/shared/config/navigation";
import { NoAccessScreen } from "@/shared/components/NoAccessScreen";
import { RouteFocus } from "@/shared/components/RouteFocus";
import { AdminSidebar } from "./AdminSidebar";
import { AdminTopbar } from "./AdminTopbar";

export function AdminShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  // Layouts do not re-run on client navigation, so each /admin page is checked here
  // against the same access rules that built the sidebar. The server still refuses it.
  const allowed = canOpenAdminPath(user, pathname);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster theme="dark" richColors />
      <RouteFocus />
      <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="lg:ml-[232px]">
        <AdminTopbar user={user} onMenuClick={() => setSidebarOpen(true)} />
        <main id="main" tabIndex={-1} className="p-4 outline-none lg:p-8">{allowed ? (
            children
          ) : (
            <NoAccessScreen
              mode="embedded"
              destination={NO_ACCESS_DESTINATION}
            />
          )}
        </main>
      </div>
    </div>
  );
}
