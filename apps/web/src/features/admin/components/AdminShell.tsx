"use client";

import { useState } from "react";
import { Toaster } from "sonner";
import type { SessionUser } from "@/shared/auth/session";
import { AdminSidebar } from "./AdminSidebar";
import { AdminTopbar } from "./AdminTopbar";

export function AdminShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster theme="dark" richColors />
      <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="lg:ml-64">
        <AdminTopbar user={user} onMenuClick={() => setSidebarOpen(true)} />
        <main className="p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
