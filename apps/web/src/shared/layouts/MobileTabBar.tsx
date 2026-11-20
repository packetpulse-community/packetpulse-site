"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Ellipsis, LogOut, X } from "lucide-react";
import { useAuth } from "@/shared/auth/AuthProvider";
import { primaryRoleLabel } from "@/shared/auth/permissions";
import { activeItemId, navigationFor } from "@/shared/config/navigation";
import { authApi } from "@/features/auth/api/auth.api";
import { cn } from "@/shared/utils/cn";
import { SidebarNav } from "./SidebarNav";

// Bottom bar below 1024 px (Document 2 §7): icon above label, 44 px touch targets,
// scrollable when a narrow phone cannot fit every tab, safe-area padding for notched
// phones. Home, Learn, Practice, Community, then "More" opens a sheet with the rest.
export function MobileTabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const auth = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const { mobile, sidebar } = useMemo(() => navigationFor(auth), [auth]);

  const allItems = useMemo(() => sidebar.flatMap((s) => s.items), [sidebar]);
  const activeId = activeItemId(allItems, pathname);
  const activeGroup = allItems.find((i) => i.id === activeId)?.group;
  const moreActive = !!activeId && mobile.more.some((s) => s.items.some((i) => i.id === activeId)) && !mobile.tabs.some((t) => t.group === activeGroup);

  // Close the sheet whenever the route changes.
  useEffect(() => setMoreOpen(false), [pathname]);

  useEffect(() => {
    if (!moreOpen) return;
    closeRef.current?.focus();
    const trigger = moreButtonRef.current;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMoreOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      trigger?.focus();
    };
  }, [moreOpen]);

  if (!auth || mobile.tabs.length === 0) return null;

  async function handleLogout() {
    await authApi.logout();
    router.push("/login");
    router.refresh();
  }

  const tabClass = (active: boolean) =>
    cn(
      "flex min-h-11 min-w-16 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-1 text-[11px] font-medium transition-colors",
      active ? "text-indigo-400" : "text-muted-foreground hover:text-foreground",
    );

  return (
    <>
      <nav
        aria-label="Primary"
        className="glass-panel-strong fixed inset-x-0 bottom-0 z-30 rounded-none border-t border-glass-border pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <ul className="flex overflow-x-auto px-1 pt-1">
          {mobile.tabs.map((tab) => {
            const Icon = tab.icon;
            const active = tab.group === activeGroup;
            return (
              <li key={tab.id} className="flex flex-1">
                <Link href={tab.href} aria-current={active ? "page" : undefined} className={tabClass(active)}>
                  <Icon className="h-5 w-5" aria-hidden="true" />
                  {tab.mobileLabel ?? tab.label}
                </Link>
              </li>
            );
          })}
          <li className="flex flex-1">
            <button
              ref={moreButtonRef}
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
              className={tabClass(moreActive)}
            >
              <Ellipsis className="h-5 w-5" aria-hidden="true" />
              More
            </button>
          </li>
        </ul>
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={() => setMoreOpen(false)} aria-hidden="true" />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="More"
            className="glass-panel-strong absolute inset-x-0 bottom-0 flex max-h-[85vh] flex-col rounded-b-none rounded-t-2xl pb-[env(safe-area-inset-bottom)]"
          >
            <div className="flex items-center justify-between border-b border-glass-border px-4 py-3">
              <div className="flex flex-col leading-tight">
                <span className="text-sm font-medium text-foreground">
                  {auth.firstName} {auth.lastName}
                </span>
                <span className="text-xs text-muted-foreground">{primaryRoleLabel(auth)}</span>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setMoreOpen(false)}
                aria-label="Close menu"
                className="flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav aria-label="More" className="flex flex-col gap-1 overflow-y-auto p-4">
              <SidebarNav sections={mobile.more} onNavigate={() => setMoreOpen(false)} size="touch" />
              <button
                type="button"
                onClick={handleLogout}
                className="mt-2 flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              >
                <LogOut className="h-5 w-5" />
                Log out
              </button>
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
