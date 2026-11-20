"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Toaster } from "sonner";
import { LegacyScope } from "@/shared/theme/LegacyScope";
import { useTheme } from "@/shared/theme/useTheme";
import type { SessionUser } from "@/shared/auth/session";
import { canOpenAdminPath, NO_ACCESS_DESTINATION } from "@/shared/config/navigation";
import { NoAccessScreen } from "@/shared/components/NoAccessScreen";
import { RouteFocus } from "@/shared/components/RouteFocus";
import { AdminSidebar } from "./AdminSidebar";
import { AdminTopbar } from "./AdminTopbar";

export function AdminShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const { resolved } = useTheme();
  // Layouts do not re-run on client navigation, so each /admin page is checked here
  // against the same access rules that built the sidebar. The server still refuses it.
  const allowed = canOpenAdminPath(user, pathname);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster theme={resolved} richColors />
      <RouteFocus />
      <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="lg:ml-[232px]">
        <AdminTopbar user={user} onMenuClick={() => setSidebarOpen(true)} />
        <main id="main" tabIndex={-1} className="p-4 outline-none lg:p-8">
          {/* Dark tokens for admin pages not yet migrated to Grove (see theme/legacy-routes.ts). */}
          <LegacyScope kind="content" className="rounded-grove-panel p-4 sm:p-6">
            {allowed ? children : <NoAccessScreen mode="embedded" destination={NO_ACCESS_DESTINATION} />}
          </LegacyScope>
        </main>
      </div>
    </div>
  );
}
