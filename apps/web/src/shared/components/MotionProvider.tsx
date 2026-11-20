"use client";

import { MotionConfig } from "framer-motion";

// Makes every framer-motion animation honour the visitor's prefers-reduced-motion
// setting (transform and layout animations are skipped, opacity still fades).
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
