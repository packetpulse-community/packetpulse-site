"use client";

import { useEffect, useRef, useState } from "react";

// Animates 0 -> target once `active` flips true, matching the live reference
// site's stats-strip counter (verified live: the resting/pre-animation DOM
// text is literally "0"). Ease-out so the count settles rather than ticking
// linearly to a stop.
export function useCountUp(target: number, active: boolean, durationMs = 1500) {
  const [value, setValue] = useState(0);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!active || startedRef.current) return;
    startedRef.current = true;

    const start = performance.now();
    let frame: number;

    const tick = (now: number) => {
      const progress = Math.min((now - start) / durationMs, 1);
      const eased = 1 - (1 - progress) ** 3;
      setValue(Math.round(eased * target));
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, target, durationMs]);

  return value;
}
