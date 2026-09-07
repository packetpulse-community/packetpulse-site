import Link from "next/link";
import { Download, ThumbsUp } from "lucide-react";
import { cardVariants } from "@/shared/ui/primitives/Card";
import { Badge } from "@/shared/ui/primitives/Badge";
import { cn } from "@/shared/utils/cn";
import type { ResourceSummary } from "../api/resources.api";

export function ResourceCard({ resource }: { resource: ResourceSummary }) {
  return (
    <Link href={`/resources/${resource.id}`} className={cn(cardVariants({ variant: "glass" }), "flex flex-col overflow-hidden")}>
      {resource.thumbnailUrl && (
        <div className="h-40 w-full overflow-hidden">
          <img src={resource.thumbnailUrl} alt={resource.title} className="h-full w-full object-cover" />
        </div>
      )}
      <div className="flex flex-col gap-2 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{resource.title}</h2>
          {resource.premium && <Badge variant="glass">Premium</Badge>}
        </div>
        <p className="line-clamp-2 text-sm text-muted-foreground">{resource.description}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="glass">{resource.resourceType}</Badge>
          <Badge variant="glass">{resource.category}</Badge>
          {!resource.isApproved && <span className="text-xs text-destructive">Pending approval</span>}
        </div>
        <div className="flex items-center gap-3 border-t border-glass-border pt-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Download className="h-3 w-3" />
            {resource.downloads}
          </span>
          <span className="flex items-center gap-1">
            <ThumbsUp className="h-3 w-3" />
            {resource._count.likes}
          </span>
        </div>
      </div>
    </Link>
  );
}
