"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/shared/utils/cn";

// Fade/translate reveal, matching the reference site's two distinct animation
// triggers verified directly against its source (LandingPage.jsx):
//  - `immediate`: above-the-fold content (the hero) fades in on mount via a
//    single page-level `isLoaded` flag — no scroll dependency, since it's
//    already visible on load.
//  - default (scroll-triggered): every other section reveals itself via its
//    own local IntersectionObserver (threshold 0.1, disconnects after the
//    first trigger) as it scrolls into view — this is duplicated per-section
//    in the source (no shared hook there either), which this component
//    consolidates without changing the observed behavior.
// Both share the same transition: transition-all duration-1000, translateY(20px)
// opacity-0 -> translateY(0) opacity-100 — matches the live site's actual inline
// per-card stagger styles (20px offset), not the older local source's 40px.
export function Reveal({
  children,
  className,
  delayMs = 0,
  as: Tag = "div",
  immediate = false,
}: {
  children: React.ReactNode;
  className?: string;
  delayMs?: number;
  as?: "div" | "article";
  immediate?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (immediate) {
      // Mirrors the source's `useEffect(() => setIsLoaded(true), [])` — flips
      // after the first paint (not synchronously) so the CSS transition is
      // actually observable rather than mounting already-visible.
      const frame = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(frame);
    }

    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [immediate]);

  return (
    <Tag
      ref={ref as never}
      style={{
        transitionDelay: `${delayMs}ms`,
        transform: visible ? "translateY(0)" : "translateY(20px)",
        opacity: visible ? 1 : 0,
      }}
      className={cn("transition-all duration-1000", className)}
    >
      {children}
    </Tag>
  );
}
