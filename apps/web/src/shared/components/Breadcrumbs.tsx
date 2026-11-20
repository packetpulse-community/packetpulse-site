"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";
import { buildCrumbs } from "./breadcrumbs-logic";

// A page that knows its real title (a thread's, a quiz's) can put it in the last
// crumb with <BreadcrumbTitle title={thread.title} />. The title is remembered with
// the path it belongs to, so it can never leak onto another page.
interface TitleState {
  path: string;
  title: string;
}
const TitleContext = createContext<{ state: TitleState | null; set: (s: TitleState | null) => void }>({
  state: null,
  set: () => {},
});

export function BreadcrumbsProvider({ children }: { children: React.ReactNode }) {
  const [state, set] = useState<TitleState | null>(null);
  const value = useMemo(() => ({ state, set }), [state]);
  return <TitleContext.Provider value={value}>{children}</TitleContext.Provider>;
}

export function BreadcrumbTitle({ title }: { title: string }) {
  const pathname = usePathname();
  const { set } = useContext(TitleContext);
  useEffect(() => {
    set({ path: pathname, title });
    return () => set(null);
  }, [pathname, title, set]);
  return null;
}

export function Breadcrumbs() {
  const pathname = usePathname();
  const { state } = useContext(TitleContext);
  const crumbs = buildCrumbs(pathname, state?.path === pathname ? state.title : null);

  if (crumbs.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="border-b border-glass-border px-4 py-2 lg:px-8">
      <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          const content = index === 0 ? <Home className="h-4 w-4" aria-label="Home" /> : crumb.label;
          return (
            <li key={`${index}-${crumb.label}`} className="flex items-center gap-1.5">
              {index > 0 && <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />}
              {isLast || !crumb.href ? (
                <span className="text-foreground" aria-current={isLast ? "page" : undefined}>
                  {content}
                </span>
              ) : (
                <Link href={crumb.href} className="flex items-center hover:text-foreground">
                  {content}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
