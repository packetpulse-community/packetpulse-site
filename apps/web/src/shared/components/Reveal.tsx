"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/shared/utils/cn";

// Scroll-triggered fade/translate reveal, matching the reference site's per-section
// IntersectionObserver animation pattern (threshold 0.1, disconnect after first
// trigger, transition-all duration-1000 translate-y-10->0 opacity-0->100).
export function Reveal({
  children,
  className,
  delayMs = 0,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  delayMs?: number;
  as?: "div" | "article";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
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
  }, []);

  return (
    <Tag
      ref={ref as never}
      style={{ transitionDelay: `${delayMs}ms` }}
      className={cn("transform transition-all duration-1000", visible ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0", className)}
    >
      {children}
    </Tag>
  );
}
