import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { forwardRef } from "react";
import { cn } from "@/shared/utils/cn";

// Variant/animation recipes ported verbatim from the reference project's
// src/components/ui/button.jsx — indigo/purple as the site's real brand colors
// (not a CSS-variable token, matching how the reference does it).
const GROVE_BASE =
  "rounded-[var(--grove-radius-control)] min-h-10 [@media(pointer:coarse)]:min-h-11 active:translate-y-px focus-visible:ring-[3px] focus-visible:ring-grove-focus focus-visible:ring-offset-2 focus-visible:ring-offset-grove-page";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-indigo-600 text-white hover:bg-indigo-700 shadow-md",
        destructive: "bg-red-500 text-white hover:bg-red-600 shadow-md",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-white text-indigo-600 hover:bg-indigo-50 border border-indigo-200 shadow-sm",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-indigo-600 underline-offset-4 hover:underline hover:text-indigo-700 p-0 h-auto",
        gradient:
          "bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 shadow-md",
        glass: "glass-panel glass-interactive text-foreground",
        // Signal Grove variants (Document 2 sections 6 and 10). They need a
        // [data-theme="grove"] ancestor. Min height 40 px, 44 px on touch screens,
        // pressed state nudges 1 px down, focus ring is 3 px with a 2 px offset.
        "grove-primary": `${GROVE_BASE} bg-grove-brand text-grove-on-brand hover:bg-grove-brand-hover active:bg-grove-brand-pressed`,
        "grove-secondary": `${GROVE_BASE} border border-grove-control bg-grove-surface text-grove-text hover:bg-grove-subtle active:bg-grove-subtle`,
        "grove-lime": `${GROVE_BASE} bg-grove-lime text-grove-on-lime hover:bg-grove-lime-hover active:bg-grove-lime-pressed`,
        "grove-destructive": `${GROVE_BASE} bg-grove-destructive text-grove-on-destructive hover:bg-grove-destructive-hover active:bg-grove-destructive-pressed`,
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8 text-base",
        icon: "h-10 w-10",
      },
      animation: {
        none: "",
        pulse: "animate-pulse",
        bounce: "hover:-translate-y-1 hover:shadow-lg",
        scale: "hover:scale-105",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      animation: "none",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /**
   * Loading state (Document 2 section 10): the label stays, a spinner is added,
   * the button reports aria-busy and repeat clicks are ignored. It stays
   * focusable (unlike disabled), so keyboard focus is not lost mid-request.
   */
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, animation, loading, onClick, children, type, ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size, animation, className }), loading && "cursor-progress")}
      aria-busy={loading || undefined}
      aria-disabled={loading || undefined}
      onClick={
        loading
          ? (e) => {
              e.preventDefault();
            }
          : onClick
      }
      {...props}
    >
      {loading && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" />}
      {children}
    </button>
  ),
);
Button.displayName = "Button";
