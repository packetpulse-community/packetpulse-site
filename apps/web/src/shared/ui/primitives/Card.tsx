import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef } from "react";
import { cn } from "@/shared/utils/cn";

// Cards use the theme tokens: surface, 1 px border, 14 px radius. `solid` and `glass` are the
// pre-Grove names and now render the same Grove card (borders first, no blur or glow).
export const cardVariants = cva("", {
  variants: {
    variant: {
      solid: "rounded-grove-card border border-border bg-surface text-text",
      glass: "rounded-grove-card border border-border bg-surface text-text",
      // Signal Grove (Document 2 section 8): surface, 1 px border, 14 px radius,
      // 16 px padding (20 from sm up) applied through CardHeader/CardContent.
      // Informational: not clickable, no hover state.
      grove: "rounded-grove-card border border-grove-border bg-grove-surface text-grove-text",
      // Interactive: hover tint, visible focus ring when its one main link has
      // focus. Put exactly one CardMainLink inside; nested controls stay above it.
      "grove-interactive":
        "group relative rounded-grove-card border border-grove-border bg-grove-surface text-grove-text transition-colors hover:bg-grove-subtle focus-within:ring-[3px] focus-within:ring-grove-focus focus-within:ring-offset-2 focus-within:ring-offset-grove-page",
    },
  },
  defaultVariants: {
    variant: "solid",
  },
});

export interface CardProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof cardVariants> {}

export const Card = forwardRef<HTMLDivElement, CardProps>(({ className, variant, ...props }, ref) => (
  <div ref={ref} className={cn(cardVariants({ variant }), className)} {...props} />
));
Card.displayName = "Card";

/**
 * The one main link of an interactive card. Its ::after stretches over the whole
 * card so the card is one click target; other controls inside the card should
 * use `relative z-10` so they stay independently clickable.
 */
export const CardMainLink = forwardRef<HTMLAnchorElement, React.AnchorHTMLAttributes<HTMLAnchorElement>>(
  ({ className, ...props }, ref) => (
    <a
      ref={ref}
      className={cn("after:absolute after:inset-0 after:rounded-grove-card focus-visible:outline-none", className)}
      {...props}
    />
  ),
);
CardMainLink.displayName = "CardMainLink";

export const CardHeader = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
  ),
);
CardHeader.displayName = "CardHeader";

export const CardTitle = forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("text-xl font-semibold leading-none tracking-tight", className)} {...props} />
  ),
);
CardTitle.displayName = "CardTitle";

export const CardDescription = forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-sm text-text-secondary", className)} {...props} />
  ),
);
CardDescription.displayName = "CardDescription";

export const CardContent = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />,
);
CardContent.displayName = "CardContent";

export const CardFooter = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />
  ),
);
CardFooter.displayName = "CardFooter";
