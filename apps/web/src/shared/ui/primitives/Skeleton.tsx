import { cn } from "@/shared/utils/cn";

// Placeholder block. Purely visual (aria-hidden); wrap a group of them in
// <SkeletonScreen label="..."> so assistive technology hears what is loading.
// The shimmer lives in shared/styles/motion.css and is removed under
// prefers-reduced-motion, leaving a static block.
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden="true" className={cn("skeleton rounded-md", className)} {...props} />;
}

// Announces a loading screen to screen readers with a hidden label (Design
// System section 9: skeletons are "announced to assistive technology with a
// hidden label"). aria-busy marks the region as not final yet.
export function SkeletonScreen({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

// Card-shaped skeleton matching the glass cards used by the list pages.
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("glass-panel flex flex-col gap-3 rounded-lg p-6", className)}>
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="mt-2 h-8 w-24" />
    </div>
  );
}
