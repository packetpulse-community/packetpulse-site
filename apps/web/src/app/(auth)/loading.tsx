import { Skeleton, SkeletonScreen } from "@/shared/ui/primitives/Skeleton";

// Sits inside the auth layout (logo and card width already shown): a form-shaped placeholder.
export default function AuthLoading() {
  return (
    <SkeletonScreen label="Loading the form, please wait" className="rounded-grove-card border border-border bg-surface flex flex-col gap-5 p-6 sm:p-8">
      <Skeleton className="h-7 w-40" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-10 w-full" />
      </div>
      <Skeleton className="h-10 w-full" />
    </SkeletonScreen>
  );
}
