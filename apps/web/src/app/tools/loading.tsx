import { Skeleton, SkeletonCard, SkeletonScreen } from "@/shared/ui/primitives/Skeleton";

// Inside the public tools layout (navbar and <main> already present).
export default function ToolsLoading() {
  return (
    <SkeletonScreen label="Loading tools, please wait" className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-9 w-72 max-w-full" />
        <Skeleton className="h-4 w-[28rem] max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </SkeletonScreen>
  );
}
