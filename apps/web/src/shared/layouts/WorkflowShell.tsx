"use client";

import { useState } from "react";
import { Toaster } from "sonner";
import { CommandPalette } from "@/shared/components/CommandPalette";
import { Breadcrumbs } from "@/shared/components/Breadcrumbs";
import { AppSidebar } from "./AppSidebar";
import { AppTopbar } from "./AppTopbar";

// Sidebar-based app shell (matches the legacy reference app's layout) — the
// persistent left rail + top bar is the general end-user experience now, not
// just an admin-only exception.
export function WorkflowShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster theme="dark" richColors />
      <CommandPalette />
      <AppSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="lg:ml-64">
        <AppTopbar onMenuClick={() => setSidebarOpen(true)} />
        <div className="border-b border-glass-border px-4 py-2 lg:px-8">
          <Breadcrumbs />
        </div>
        <main className="mx-auto max-w-5xl px-4 py-8 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
