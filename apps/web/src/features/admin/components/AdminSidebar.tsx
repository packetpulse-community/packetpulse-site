"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, LogOut, X } from "lucide-react";
import { cn } from "@/shared/utils/cn";
import { authApi } from "@/features/auth/api/auth.api";
import { useAuth } from "@/shared/auth/AuthProvider";
import { navigationFor } from "@/shared/config/navigation";
import { SidebarNav } from "@/shared/layouts/SidebarNav";

interface AdminSidebarProps {
  open: boolean;
  onClose: () => void;
}

// The admin rail is the same navigation model as the member sidebar, cut to the
// pages this person may open inside /admin (admins: everything; moderators: only
// the moderation lists their permissions allow).
export function AdminSidebar({ open, onClose }: AdminSidebarProps) {
  const router = useRouter();
  const auth = useAuth();
  const { admin } = useMemo(() => navigationFor(auth), [auth]);

  async function handleLogout() {
    await authApi.logout();
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-30 bg-background/60 backdrop-blur-sm lg:hidden" onClick={onClose} aria-hidden="true" />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[232px] flex-col border-r border-border bg-card transition-transform duration-300 ease-in-out lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-border px-4">
          <Link href="/admin" className="font-semibold">
            PacketPulse Admin
          </Link>
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="flex h-11 w-11 items-center justify-center text-muted-foreground hover:text-foreground lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav aria-label="Admin" className="flex flex-1 flex-col gap-1 overflow-y-auto p-4">
          <Link
            href="/dashboard"
            onClick={onClose}
            className="mb-2 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            Back to PacketPulse
          </Link>
          <SidebarNav sections={admin} onNavigate={onClose} />
        </nav>

        <div className="border-t border-border p-4">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            <LogOut className="h-5 w-5" />
            Log out
          </button>
        </div>
      </aside>
    </>
  );
}
