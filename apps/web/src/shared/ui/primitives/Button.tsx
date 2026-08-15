import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef } from "react";
import { cn } from "@/shared/utils/cn";

// Variant/animation recipes ported verbatim from the reference project's
// src/components/ui/button.jsx — indigo/purple as the site's real brand colors
// (not a CSS-variable token, matching how the reference does it).
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
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, animation, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size, animation, className }))} {...props} />
  ),
);
Button.displayName = "Button";
