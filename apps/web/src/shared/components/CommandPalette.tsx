"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { navCommands } from "@/shared/config/navigation";

// The primary cross-domain navigation mechanism (plan §6) — fuzzy-searches across
// domains rather than requiring the user to know where something lives in a menu
// hierarchy. Triggered by ⌘K/Ctrl+K from anywhere inside the protected shell.
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  if (!open) return null;

  const groups = [...new Set(navCommands.map((c) => c.group))];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-24" onClick={() => setOpen(false)}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg rounded-lg border border-border bg-card shadow-xl">
        <Command label="Command palette">
          <Command.Input
            autoFocus
            placeholder="Search PacketPulse…"
            className="w-full border-b border-border bg-transparent px-4 py-3 outline-none"
          />
          <Command.List className="max-h-96 overflow-y-auto p-2">
            <Command.Empty className="px-2 py-4 text-center text-sm text-muted-foreground">No results.</Command.Empty>
            {groups.map((group) => (
              <Command.Group key={group} heading={group} className="px-2 py-1 text-xs text-muted-foreground">
                {navCommands
                  .filter((c) => c.group === group)
                  .map((cmd) => (
                    <Command.Item
                      key={cmd.href + cmd.label}
                      value={`${cmd.label} ${cmd.keywords?.join(" ") ?? ""}`}
                      onSelect={() => go(cmd.href)}
                      className="cursor-pointer rounded px-2 py-2 text-sm data-[selected=true]:bg-accent"
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
