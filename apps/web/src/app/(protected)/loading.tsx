import { Skeleton, SkeletonCard, SkeletonScreen } from "@/shared/ui/primitives/Skeleton";

// Matches the shared list-page layout (centered heading, filter row, card grid)
// used by resources, recordings and quizzes, so nothing jumps when data arrives.
export default function ProtectedLoading() {
  return (
    <SkeletonScreen label="Loading, please wait" className="flex flex-col gap-8">
      <div className="flex flex-col items-center gap-3">
        <Skeleton className="h-9 w-64 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-10 min-w-48 flex-1" />
        <Skeleton className="h-10 w-36" />
        <Skeleton className="h-10 w-36" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </SkeletonScreen>
  );
}
