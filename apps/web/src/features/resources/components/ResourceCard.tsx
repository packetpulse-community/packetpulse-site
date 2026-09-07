import Link from "next/link";
import { cardVariants } from "@/shared/ui/primitives/Card";
import { Badge } from "@/shared/ui/primitives/Badge";
import { cn } from "@/shared/utils/cn";
import type { ResourceSummary } from "../api/resources.api";

export function ResourceCard({ resource }: { resource: ResourceSummary }) {
  return (
    <Link href={`/resources/${resource.id}`} className={cn(cardVariants({ variant: "glass" }), "flex flex-col gap-2 p-4")}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{resource.title}</h2>
        {resource.premium && <Badge variant="glass">Premium</Badge>}
      </div>
      <p className="line-clamp-2 text-sm text-muted-foreground">{resource.description}</p>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>{resource.resourceType}</span>
        <span>·</span>
        <span>{resource.category}</span>
        <span>·</span>
        <span>{resource.downloads} downloads</span>
        <span>·</span>
        <span>{resource._count.likes} likes</span>
        {!resource.isApproved && <span className="text-destructive">Pending approval</span>}
      </div>
    </Link>
  );
}
