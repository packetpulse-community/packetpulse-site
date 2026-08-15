"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Menu } from "lucide-react";
import { NotificationBell } from "@/features/notifications/components/NotificationBell";
import { authApi } from "@/features/auth/api/auth.api";
import type { SessionUser } from "@/shared/auth/session";
import { cn } from "@/shared/utils/cn";

interface AdminTopbarProps {
  user: SessionUser;
  onMenuClick: () => void;
}

export function AdminTopbar({ user, onMenuClick }: AdminTopbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

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

  const initials = `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase();

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-card px-4 lg:px-8">
      <button onClick={onMenuClick} className="text-muted-foreground hover:text-foreground lg:hidden">
        <Menu className="h-6 w-6" />
      </button>
      <div className="hidden lg:block" />

      <div className="flex items-center gap-4">
        <NotificationBell />

        <div ref={menuRef} className="relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-2 text-sm text-foreground hover:text-primary"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              {initials || "A"}
            </span>
            <span className="hidden md:block">{user.firstName}</span>
            <ChevronDown className={cn("h-4 w-4 transition-transform", menuOpen && "rotate-180")} />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-10 z-20 w-48 rounded-lg border border-border bg-popover py-1 shadow-lg">
              <Link
                href="/profile"
                onClick={() => setMenuOpen(false)}
                className="block px-4 py-2 text-sm text-popover-foreground hover:bg-accent hover:text-accent-foreground"
              >
                Profile
              </Link>
              <div className="my-1 border-t border-border" />
              <button
                onClick={handleLogout}
                className="block w-full px-4 py-2 text-left text-sm text-popover-foreground hover:bg-accent hover:text-accent-foreground"
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
