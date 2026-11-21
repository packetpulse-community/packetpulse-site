"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/shared/utils/cn";

// Horizontal scroll container that is keyboard-reachable only when it actually overflows
// (WCAG 2.1.1; axe "scrollable-region-focusable"). A named group, not a region: many can sit on one page. When it fits it adds no tab stop and no landmark noise.
export function ScrollRegion({
  label,
  className,
  as: Tag = "div",
  children,
}: {
  label: string;
  className?: string;
  as?: "div" | "pre";
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setOverflowing(el.scrollWidth > el.clientWidth + 1);
    check();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [children]);

  return (
    <Tag
      ref={ref as never}
      className={cn("overflow-x-auto", className)}
      {...(overflowing ? { tabIndex: 0, role: "group", "aria-label": label } : {})}
    >
      {children}
    </Tag>
  );
}
