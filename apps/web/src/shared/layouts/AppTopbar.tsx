"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { NotificationBell } from "@/features/notifications/components/NotificationBell";
import { authApi } from "@/features/auth/api/auth.api";
import { useAuth } from "@/shared/auth/AuthProvider";
import { cn } from "@/shared/utils/cn";

export function AppTopbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const auth = useAuth();

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  async function handleLogout() {
    await authApi.logout();
    router.push("/login");
    router.refresh();
  }

  const initials = auth ? `${auth.firstName[0] ?? ""}${auth.lastName[0] ?? ""}`.toUpperCase() : "";

  return (
    <header className="glass-panel-strong sticky top-0 z-20 flex h-16 items-center justify-between gap-4 rounded-none px-4 lg:px-8">
      {/* Below 1024 px the sidebar is replaced by the bottom tab bar, so the logo takes its place. */}
      <Link href="/dashboard" className="flex items-center gap-2 font-semibold lg:hidden">
        <Image src="/logo.png" alt="PacketPulse" width={28} height={28} className="h-7 w-auto" />
        <span className="sr-only sm:not-sr-only">PacketPulse</span>
      </Link>

      <button
        onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
        className="hidden max-w-md flex-1 items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground hover:border-primary sm:flex"
      >
        <Search className="h-4 w-4" />
        Search for resources, recordings, blogs…
        <span className="ml-auto rounded border border-border px-1.5 py-0.5 text-xs">⌘K</span>
      </button>

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
          aria-label="Search"
          className="flex h-11 w-11 items-center justify-center text-muted-foreground hover:text-foreground sm:hidden"
        >
          <Search className="h-5 w-5" />
        </button>
        <NotificationBell />

        <div ref={menuRef} className="relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-2 text-sm text-foreground hover:text-indigo-500"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
              {initials || "U"}
            </span>
            <span className="hidden md:block">{auth?.firstName}</span>
            <ChevronDown className={cn("h-4 w-4 transition-transform", menuOpen && "rotate-180")} />
          </button>

          {menuOpen && (
            <div className="glass-panel-strong absolute right-0 top-10 z-20 w-56 rounded-lg py-1">
              <Link
                href="/profile"
                onClick={() => setMenuOpen(false)}
                className="block px-4 py-2 text-sm text-foreground hover:bg-accent hover:text-accent-foreground"
              >
                Profile
              </Link>
              <Link
                href="/settings/notifications"
                onClick={() => setMenuOpen(false)}
                className="block px-4 py-2 text-sm text-foreground hover:bg-accent hover:text-accent-foreground"
              >
                Notification settings
              </Link>
              <div className="my-1 border-t border-glass-border" />
              <button
                onClick={handleLogout}
                className="block w-full px-4 py-2 text-left text-sm text-foreground hover:bg-accent hover:text-accent-foreground"
              >
                Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
