import { Skeleton, SkeletonCard, SkeletonScreen } from "@/shared/ui/primitives/Skeleton";

// Inside the blogs layout: centered heading, filter row, three-column post grid (as blogs/page.tsx).
export default function BlogsLoading() {
  return (
    <SkeletonScreen label="Loading articles, please wait" className="flex flex-col gap-8">
      <div className="flex flex-col items-center gap-3">
        <Skeleton className="h-9 w-80 max-w-full" />
        <Skeleton className="h-4 w-[32rem] max-w-full" />
      </div>
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-10 min-w-48 flex-1" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </SkeletonScreen>
  );
}
