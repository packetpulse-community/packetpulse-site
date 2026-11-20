"use client";

import { useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { useAuth } from "@/shared/auth/AuthProvider";
import { primaryRoleLabel } from "@/shared/auth/permissions";
import { navigationFor } from "@/shared/config/navigation";
import { authApi } from "@/features/auth/api/auth.api";
import { SidebarNav } from "./SidebarNav";

// Persistent left navigation, 232 px from 1024 px (Document 2 §7). Below 1024 px the
// MobileTabBar takes over, so this rail is simply not rendered there.
export function AppSidebar() {
  const router = useRouter();
  const auth = useAuth();
  const { sidebar } = useMemo(() => navigationFor(auth), [auth]);

  async function handleLogout() {
    await authApi.logout();
    router.push("/login");
    router.refresh();
  }

  const initials = auth ? `${auth.firstName[0] ?? ""}${auth.lastName[0] ?? ""}`.toUpperCase() : "";

  return (
    <aside className="glass-panel-strong fixed inset-y-0 left-0 z-40 hidden w-[232px] flex-col rounded-none lg:flex">
      <div className="flex h-16 items-center border-b border-glass-border px-4">
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
          <Image src="/logo.png" alt="PacketPulse" width={28} height={28} className="h-7 w-auto" />
          PacketPulse
        </Link>
      </div>

      <nav aria-label="Main" className="flex flex-1 flex-col gap-1 overflow-y-auto p-4">
        <SidebarNav sections={sidebar} />
      </nav>

      <div className="border-t border-glass-border p-4">
        <div className="mb-2 flex items-center gap-3 px-1">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
            {initials || "U"}
          </span>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-medium text-foreground">
              {auth?.firstName} {auth?.lastName}
            </span>
            <span className="text-xs text-muted-foreground">{auth ? primaryRoleLabel(auth) : "Member"}</span>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        >
          <LogOut className="h-5 w-5" />
          Log out
        </button>
      </div>
    </aside>
  );
}
