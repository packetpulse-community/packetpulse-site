"use client";

import { Toaster } from "sonner";
import { CommandPalette } from "@/shared/components/CommandPalette";
import { Breadcrumbs } from "@/shared/components/Breadcrumbs";
import { RouteFocus } from "@/shared/components/RouteFocus";
import { ResendVerificationBanner } from "@/features/auth/components/ResendVerificationBanner";
import { AppSidebar } from "./AppSidebar";
import { AppTopbar } from "./AppTopbar";
import { MobileTabBar } from "./MobileTabBar";

// Sidebar-based app shell (matches the legacy reference app's layout) — the
// persistent left rail + top bar is the general end-user experience now, not
// just an admin-only exception.
export function WorkflowShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster theme="dark" richColors />
      <CommandPalette />
      <RouteFocus />
      <AppSidebar />
      <div className="lg:ml-[232px]">
        <AppTopbar />
        <div className="border-b border-glass-border px-4 py-2 lg:px-8">
          <Breadcrumbs />
        </div>
        <main id="main" tabIndex={-1} className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-8 pb-24 outline-none lg:px-8 lg:pb-8">
          <ResendVerificationBanner />
          {children}
        </main>
      </div>
      <MobileTabBar />
    </div>
  );
}
