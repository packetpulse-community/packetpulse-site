"use client";

import { useEffect, useRef, useState } from "react";
import { Reveal } from "@/shared/components/Reveal";
import { useCountUp } from "@/shared/hooks/useCountUp";

// Illustrative figures, not wired to real data — the only real aggregate-stats
// endpoint (GET /dashboard/stats) sits behind the auth guard chain and isn't
// reachable for anonymous visitors. Mixing one real number in with fabricated
// ones would be misleading, so the whole strip stays clearly illustrative
// (consistent with the hero's own "2000+ network professionals" copy).
const STATS = [
  { label: "Members", target: 2000, suffix: "+" },
  { label: "Resources", target: 500, suffix: "+" },
  { label: "Certifications", target: 50, suffix: "+" },
  { label: "Countries", target: 30, suffix: "+" },
];

function StatValue({ target, suffix, active }: { target: number; suffix: string; active: boolean }) {
  const count = useCountUp(target, active);
  return (
    <p className="text-3xl font-bold text-indigo-400 sm:text-4xl">
      {count}
      {suffix}
    </p>
  );
}

export function StatsStrip() {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setActive(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={ref} className="container py-16">
      <Reveal className="rounded-2xl border border-white/10 bg-indigo-900/10 p-8 shadow-xl backdrop-blur-md md:p-10">
        <h2 className="mb-10 text-center text-2xl font-semibold">Our Growth in Numbers</h2>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          {STATS.map((stat) => (
            <div key={stat.label} className="flex flex-col items-center text-center">
              <StatValue target={stat.target} suffix={stat.suffix} active={active} />
              <p className="mt-1 text-sm text-gray-300">{stat.label}</p>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}
