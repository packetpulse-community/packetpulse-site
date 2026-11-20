import { Skeleton, SkeletonScreen } from "@/shared/ui/primitives/Skeleton";

// Sits inside the auth layout (logo and card width already shown): a form-shaped placeholder.
export default function AuthLoading() {
  return (
    <SkeletonScreen label="Loading the form, please wait" className="glass-panel flex flex-col gap-5 rounded-lg p-6">
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
