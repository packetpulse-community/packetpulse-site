"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { useAuth } from "@/shared/auth/AuthProvider";
import { navigationFor } from "@/shared/config/navigation";

// The primary cross-domain navigation mechanism (plan §6) — fuzzy-searches across
// domains rather than requiring the user to know where something lives in a menu
// hierarchy. Triggered by ⌘K/Ctrl+K from anywhere inside the protected shell.
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const router = useRouter();
  const auth = useAuth();
  // Role-aware: only what this person may use (the server re-checks every page anyway).
  const entries = useMemo(() => navigationFor(auth).palette, [auth]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        // Capture the trigger before the autofocused search box takes focus.
        if (document.activeElement instanceof HTMLElement && !panelRef.current?.contains(document.activeElement)) {
          returnFocusRef.current = document.activeElement;
        }
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Modal behaviour (WCAG 2.1.2 / 2.4.3): remember what had focus so closing hands it back, and keep Tab
  // inside the palette while it is open (the trigger is captured in the Ctrl/Cmd+K handler). Arrow keys and Enter are cmdk's own.
  useEffect(() => {
    if (!open) return;
    return () => {
      const target = returnFocusRef.current;
      if (target && document.contains(target)) target.focus();
    };
  }, [open]);

  function trapTab(e: React.KeyboardEvent) {
    if (e.key !== "Tab") return;
    const panel = panelRef.current;
    if (!panel) return;
    const focusable = Array.from(panel.querySelectorAll<HTMLElement>("input, button:not([disabled]), a[href], [tabindex]:not([tabindex='-1'])"));
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;
    const active = document.activeElement;
    if (e.shiftKey && (active === first || !panel.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !panel.contains(active))) {
      e.preventDefault();
      first.focus();
    }
  }

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  if (!open) return null;

  const groups = [...new Set(entries.map((c) => c.group))];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-grove-scrim pt-24" onClick={() => setOpen(false)}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onKeyDown={trapTab}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-grove-card border border-border bg-surface text-text shadow-grove-overlay"
      >
        <Command label="Command palette">
          <Command.Input
            autoFocus
            aria-label="Search PacketPulse"
            placeholder="Search PacketPulse…"
            className="w-full border-b border-border bg-transparent px-4 py-3 outline-none"
          />
          <Command.List className="max-h-96 overflow-y-auto p-2">
            <Command.Empty className="px-2 py-4 text-center text-sm text-muted-foreground">No results.</Command.Empty>
            {groups.map((group) => (
              <Command.Group key={group} heading={group} className="px-2 py-1 text-xs text-muted-foreground">
                {entries
                  .filter((c) => c.group === group)
                  .map((cmd) => (
                    <Command.Item
                      key={cmd.id}
                      value={`${cmd.label} ${cmd.keywords?.join(" ") ?? ""}`}
                      onSelect={() => go(cmd.href)}
                      className="cursor-pointer rounded-grove-tag px-2 py-2 text-sm data-[selected=true]:bg-surface-subtle"
                    >
                      {cmd.label}
                    </Command.Item>
                  ))}
              </Command.Group>
            ))}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
