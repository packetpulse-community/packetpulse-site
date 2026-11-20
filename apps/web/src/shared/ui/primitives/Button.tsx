import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { forwardRef } from "react";
import { cn } from "@/shared/utils/cn";

// Signal Grove buttons (Document 2 sections 6 and 10): every variant resolves to the theme
// tokens, so it follows Light/Dark. The pre-Grove names (default, gradient, secondary, outline,
// ghost, link, glass, destructive) are kept as aliases so existing screens keep compiling and
// pick up the new look; new code should use `primary`, `secondary`, `lime`, `ghost`, `destructive`.
const GROVE_BASE =
  "rounded-[var(--grove-radius-control)] min-h-10 [@media(pointer:coarse)]:min-h-11 active:translate-y-px focus-visible:ring-[3px] focus-visible:ring-grove-focus focus-visible:ring-offset-2 focus-visible:ring-offset-grove-page";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-grove-control text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-offset-2 active:translate-y-px disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-pressed",
        destructive: "bg-grove-destructive text-grove-on-destructive hover:bg-grove-destructive-hover active:bg-grove-destructive-pressed",
        outline: "border border-control bg-surface text-text hover:bg-surface-subtle",
        secondary: "border border-control bg-surface text-text hover:bg-surface-subtle",
        ghost: "text-text hover:bg-surface-subtle",
        link: "text-primary-text underline-offset-4 hover:underline p-0 h-auto",
        gradient: "bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-pressed",
        glass: "border border-control bg-surface/80 text-text hover:bg-surface-subtle",
        lime: "bg-accent text-accent-foreground hover:bg-accent-hover active:bg-accent-pressed",
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
        sm: "h-9 px-3",
        lg: "h-11 px-8 text-base",
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
