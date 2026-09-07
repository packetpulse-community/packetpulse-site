"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { Home, FileText, Video, Users, BookOpen, HelpCircle, ShieldCheck, LogOut, X } from "lucide-react";
import { cn } from "@/shared/utils/cn";
import { useAuth } from "@/shared/auth/AuthProvider";
import { authApi } from "@/features/auth/api/auth.api";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: Home },
  { label: "Resources", href: "/resources", icon: FileText },
  { label: "Recordings", href: "/recordings", icon: Video },
  { label: "Blogs", href: "/blogs", icon: BookOpen },
  { label: "Forums", href: "/forums", icon: Users },
  { label: "Quizzes", href: "/quizzes", icon: HelpCircle },
] as const;

export function AppSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const auth = useAuth();
  const isAdmin = auth?.roles.includes("admin") || auth?.roles.includes("super_admin");

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  async function handleLogout() {
    await authApi.logout();
    router.push("/login");
    router.refresh();
  }

  const initials = auth ? `${auth.firstName[0] ?? ""}${auth.lastName[0] ?? ""}`.toUpperCase() : "";

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-30 bg-background/60 backdrop-blur-sm lg:hidden" onClick={onClose} aria-hidden="true" />
      )}
      <aside
        className={cn(
          "glass-panel-strong fixed inset-y-0 left-0 z-40 flex w-64 flex-col rounded-none transition-transform duration-300 ease-in-out lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-glass-border px-4">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
            <Image src="/logo.png" alt="PacketPulse" width={28} height={28} className="h-7 w-auto" />
            PacketPulse
          </Link>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground lg:hidden">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-4">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-indigo-600 text-white shadow-md"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}

          {isAdmin && (
            <Link
              href="/admin"
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                pathname.startsWith("/admin")
                  ? "bg-indigo-600 text-white shadow-md"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <ShieldCheck className="h-5 w-5" />
              Admin
            </Link>
          )}
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
              <span className="text-xs text-muted-foreground">{isAdmin ? "Administrator" : "Member"}</span>
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
    </>
  );
}
