import { Skeleton, SkeletonScreen } from "@/shared/ui/primitives/Skeleton";

// Matches the admin list pages: page title and action, then a table-like card.
export default function AdminLoading() {
  return (
    <SkeletonScreen label="Loading the admin list, please wait" className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="border border-border bg-surface flex flex-col divide-y divide-border rounded-lg">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex items-center justify-between gap-4 p-4">
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-8 w-20" />
          </div>
        ))}
      </div>
    </SkeletonScreen>
  );
}
