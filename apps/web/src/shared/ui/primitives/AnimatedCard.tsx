"use client";

import { motion, useMotionTemplate, useMotionValue, useSpring, useTransform } from "framer-motion";
import { cn } from "@/shared/utils/cn";

interface AnimatedCardProps {
  children: React.ReactNode;
  className?: string;
  glowColor?: string;
}

// Mouse-tracking tilt + spotlight + colored glow, ported from the reference
// project's src/components/ui/animated-card.jsx (framer-motion, already a
// dependency here).
export function AnimatedCard({ children, className, glowColor = "rgba(100,100,255,0.15)" }: AnimatedCardProps) {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [10, -10]), { stiffness: 300, damping: 20 });
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-10, 10]), { stiffness: 300, damping: 20 });
  const scale = useSpring(1, { stiffness: 300, damping: 20 });

  const spotlightBackground = useMotionTemplate`radial-gradient(200px circle at ${useTransform(mouseX, (x) => `${(x + 0.5) * 100}%`)} ${useTransform(mouseY, (y) => `${(y + 0.5) * 100}%`)}, rgba(255,255,255,0.06), transparent 80%)`;

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    mouseX.set((e.clientX - rect.left) / rect.width - 0.5);
    mouseY.set((e.clientY - rect.top) / rect.height - 0.5);
    scale.set(1.02);
  }

  function handleMouseLeave() {
    mouseX.set(0);
    mouseY.set(0);
    scale.set(1);
  }

  return (
    <motion.div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ rotateX, rotateY, scale, transformStyle: "preserve-3d" }}
      whileHover={{ boxShadow: `0 20px 25px -5px ${glowColor}, 0 8px 10px -6px ${glowColor}` }}
      initial={{ boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)" }}
      className={cn(
        "relative overflow-hidden rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-gray-900",
        className,
      )}
    >
      <motion.div className="pointer-events-none absolute inset-0" style={{ background: spotlightBackground }} />
      <div style={{ transform: "translateZ(20px)" }}>{children}</div>
    </motion.div>
  );
}
