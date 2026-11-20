"use client";

import { useId } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/shared/utils/cn";
import type { ThemePreference } from "./theme";
import { useTheme } from "./useTheme";

const OPTIONS: { value: ThemePreference; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
];

/**
 * Light / Dark / System switch. Native radios, so arrow keys, focus and screen readers work with
 * no extra code. `compact` shows icons only (labels stay available to assistive tech) for the
 * top bar and the mobile menu; the default shows icon and label.
 */
export function ThemeSwitch({ compact = false, className }: { compact?: boolean; className?: string }) {
  const { preference, setPreference } = useTheme();
  const name = useId();

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className={cn("inline-flex items-center gap-0.5 rounded-grove-control border border-border bg-surface p-0.5", className)}
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const id = `${name}-${value}`;
        const selected = preference === value;
        return (
          <label
            key={value}
            htmlFor={id}
            title={label}
            className={cn(
              "inline-flex min-h-9 cursor-pointer items-center justify-center gap-1.5 rounded-[calc(var(--grove-radius-control)-2px)] px-2.5 text-sm font-medium transition-colors [@media(pointer:coarse)]:min-h-11",
              "has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-grove-focus has-[:focus-visible]:ring-offset-1 has-[:focus-visible]:ring-offset-background",
              selected ? "bg-primary text-primary-foreground" : "text-text-secondary hover:bg-surface-subtle hover:text-text",
            )}
          >
            <input
              id={id}
              type="radio"
              name={name}
              value={value}
              checked={selected}
              onChange={() => setPreference(value)}
              className="sr-only"
            />
            <Icon aria-hidden="true" className="h-4 w-4" />
            <span className={cn(compact && "sr-only")}>{label}</span>
          </label>
        );
      })}
    </div>
  );
}
