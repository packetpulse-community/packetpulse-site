"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { NotificationBell } from "@/features/notifications/components/NotificationBell";
import { authApi } from "@/features/auth/api/auth.api";
import { useAuth } from "@/shared/auth/AuthProvider";
import { BrandLogo } from "@/shared/components/BrandLogo";
import { cn } from "@/shared/utils/cn";
import { ThemeSwitch } from "@/shared/theme/ThemeSwitch";

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
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-border bg-surface px-4 lg:px-8">
      {/* Below 1024 px the sidebar is replaced by the bottom tab bar, so the logo takes its place. */}
      <Link href="/dashboard" className="flex items-center gap-2 font-semibold lg:hidden">
        <BrandLogo />
      </Link>

      <button
        onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
        className="hidden max-w-md flex-1 items-center gap-2 rounded-grove-control border border-control bg-surface px-3 py-2 text-sm text-text-secondary hover:border-primary sm:flex"
      >
        <Search className="h-4 w-4" />
        Search for resources, recordings, blogs…
        <span className="ml-auto rounded-grove-tag border border-border px-1.5 py-0.5 text-xs">⌘K</span>
      </button>

      <div className="flex items-center gap-2 sm:gap-4">
        <ThemeSwitch compact className="hidden md:inline-flex" />
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
            className="flex items-center gap-2 text-sm text-foreground hover:text-primary-text"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              {initials || "U"}
            </span>
            <span className="hidden md:block">{auth?.firstName}</span>
            <ChevronDown className={cn("h-4 w-4 transition-transform", menuOpen && "rotate-180")} />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-10 z-20 w-56 rounded-grove-card border border-border bg-surface py-1 shadow-grove-overlay">
              <Link
                href="/profile"
                onClick={() => setMenuOpen(false)}
                className="block px-4 py-2 text-sm text-foreground hover:bg-surface-subtle"
              >
                Profile
              </Link>
              <Link
                href="/settings/notifications"
                onClick={() => setMenuOpen(false)}
                className="block px-4 py-2 text-sm text-foreground hover:bg-surface-subtle"
              >
                Notification settings
              </Link>
              <div className="px-4 py-2 md:hidden">
                <p className="mb-1.5 text-xs font-medium text-text-secondary">Theme</p>
                <ThemeSwitch />
              </div>
              <div className="my-1 border-t border-border" />
              <button
                onClick={handleLogout}
                className="block w-full px-4 py-2 text-left text-sm text-foreground hover:bg-surface-subtle"
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
