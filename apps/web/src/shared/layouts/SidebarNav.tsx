"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { activeItemId, type NavSection } from "@/shared/config/navigation";
import { cn } from "@/shared/utils/cn";

// Renders the sections navigationFor() produced. Shared by the member sidebar, the
// admin sidebar and the mobile "More" sheet so the active marker and spacing match.
export function SidebarNav({
  sections,
  onNavigate,
  size = "default",
}: {
  sections: NavSection[];
  onNavigate?: () => void;
  size?: "default" | "touch";
}) {
  const pathname = usePathname();
  const activeId = activeItemId(
    sections.flatMap((s) => s.items),
    pathname,
  );

  return (
    <>
      {sections.map((section) => (
        <div key={section.id} className="flex flex-col gap-1">
          {section.showHeading && (
            <p className="px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {section.label}
            </p>
          )}
          {section.items.map((item) => {
            const Icon = item.icon;
            const active = item.id === activeId;
            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex items-center gap-3 rounded-grove-control px-3 text-sm font-medium transition-colors",
                  size === "touch" ? "min-h-11 py-2.5" : "py-2.5",
                  active
                    ? "bg-primary text-primary-foreground before:absolute before:-left-1 before:top-2 before:bottom-2 before:w-1 before:rounded-full before:bg-accent"
                    : "text-text-secondary hover:bg-surface-subtle hover:text-text",
                )}
              >
                <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </>
  );
}
