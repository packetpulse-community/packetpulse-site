"use client";

import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { forwardRef, useState } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/shared/utils/cn";

// The pre-Grove names (info, success, warning, error) now use the semantic state tokens; the
// grove-* names are the same thing with the left accent bar. Both always show a glyph.
const GROVE_ALERT = "rounded-[var(--grove-radius-control)] border-0 border-l-4 shadow-none";

export const alertVariants = cva(
  "relative w-full rounded-grove-control border p-4 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg~*]:pl-7",
  {
    variants: {
      variant: {
        default: "border-border bg-surface text-text",
        info: "border-info bg-info-soft text-info",
        success: "border-success bg-success-soft text-success",
        warning: "border-warning bg-warning-soft text-warning",
        error: "border-danger bg-danger-soft text-danger",
        glass: "border-border bg-surface text-text",
        // Signal Grove semantic alerts (Document 2 4.3): soft background, strong
        // text colour, a left accent bar and a glyph, so colour is never alone.
        "grove-information": GROVE_ALERT + " border-state-information bg-state-information-soft text-state-information",
        "grove-success": GROVE_ALERT + " border-state-success bg-state-success-soft text-state-success",
        "grove-warning": GROVE_ALERT + " border-state-warning bg-state-warning-soft text-state-warning",
        "grove-danger": GROVE_ALERT + " border-state-danger bg-state-danger-soft text-state-danger",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const VARIANT_ICONS = {
  default: Info,
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: AlertCircle,
  glass: Info,
  "grove-information": Info,
  "grove-success": CheckCircle2,
  "grove-warning": AlertTriangle,
  "grove-danger": AlertCircle,
} as const;

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  dismissible?: boolean;
  onDismiss?: () => void;
}

export const Alert = forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = "default", dismissible, onDismiss, children, role: roleProp, ...props }, ref) => {
    const [dismissed, setDismissed] = useState(false);
    // Existing variants keep role="alert". Grove variants follow Document 2
    // section 10: only errors use the alert role, others are polite status.
    const role = roleProp ?? (variant?.startsWith("grove-") ? "status" : "alert");
    const Icon = VARIANT_ICONS[variant ?? "default"];

    if (dismissed) return null;

    return (
      <div ref={ref} role={variant === "grove-danger" ? "alert" : role} className={cn(alertVariants({ variant }), className)} {...props}>
        <Icon className="h-4 w-4" />
        <div>{children}</div>
        {dismissible && (
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => {
              setDismissed(true);
              onDismiss?.();
            }}
            className="absolute right-3 top-3 rounded-md p-1 opacity-70 hover:opacity-100"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  },
);
Alert.displayName = "Alert";

export const AlertTitle = forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h5 ref={ref} className={cn("mb-1 font-medium leading-none tracking-tight", className)} {...props} />
  ),
);
AlertTitle.displayName = "AlertTitle";

export const AlertDescription = forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => <p ref={ref} className={cn("text-sm [&_p]:leading-relaxed", className)} {...props} />,
);
AlertDescription.displayName = "AlertDescription";
