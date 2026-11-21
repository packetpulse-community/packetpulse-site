"use client";

import { cn } from "@/shared/utils/cn";

interface FeatureSwitchProps {
  /** Id of the element that names this switch (the flag title). */
  labelledBy: string;
  describedBy?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}

// A real switch: role="switch" with aria-checked on a native button, so it is reachable by
// keyboard (Space or Enter) and announced as "on" or "off". State is also written out next
// to it by the caller, so colour is never the only signal.
export function FeatureSwitch({ labelledBy, describedBy, checked, disabled, onChange }: FeatureSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border border-border transition-colors",
        "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-primary" : "bg-surface-subtle",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "inline-block h-5 w-5 rounded-full bg-surface shadow transition-transform motion-reduce:transition-none",
          checked ? "translate-x-6" : "translate-x-1",
        )}
      />
    </button>
  );
}
