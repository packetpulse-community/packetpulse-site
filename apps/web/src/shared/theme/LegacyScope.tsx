"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/shared/utils/cn";
import { legacyScopeFor, type LegacyScopeKind } from "./legacy-routes";

/**
 * Legacy dark surface. A `.dark` element re-declares the dark Grove tokens for its subtree, so
 * screens that still use hard-coded dark glass classes (text-white, bg-slate-900/50, ...) and
 * the `dark:` variants stay readable while the app default is light. It renders the same
 * element for every route (only the classes change), so navigating between legacy and migrated
 * routes never remounts the children.
 *
 * "page" scope is mounted by the root layout; "content" scope by the app shells. Which routes
 * are legacy is decided by legacy-routes.ts only.
 */

// Radix portals (dialogs, selects, tooltips) render in <body>, outside the scope element, so
// they would lose the dark tokens. Primitives read this element and portal into it instead.
const PortalContainerContext = createContext<HTMLElement | null>(null);

export function usePortalContainer(): HTMLElement | undefined {
  return useContext(PortalContainerContext) ?? undefined;
}

export function LegacyScope({
  kind,
  className,
  children,
}: {
  kind: LegacyScopeKind;
  className?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = legacyScopeFor(pathname) === kind;
  const [element, setElement] = useState<HTMLElement | null>(null);

  // Page scope also marks <body>, so toasts and anything portalled to <body> get the dark tokens.
  useEffect(() => {
    if (kind !== "page") return;
    document.body.classList.toggle("dark", active);
    document.body.toggleAttribute("data-legacy-dark", active);
    return () => {
      document.body.classList.remove("dark");
      document.body.removeAttribute("data-legacy-dark");
    };
  }, [kind, active]);

  return (
    <PortalContainerContext.Provider value={active ? element : null}>
      <div
        ref={setElement}
        data-legacy-scope={kind}
        data-legacy-dark={active ? "" : undefined}
        className={cn(active && "dark bg-background text-foreground", kind === "page" && "min-h-screen", className)}
      >
        {children}
      </div>
    </PortalContainerContext.Provider>
  );
}
