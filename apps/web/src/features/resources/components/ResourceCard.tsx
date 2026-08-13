import Link from "next/link";
import type { ResourceSummary } from "../api/resources.api";

export function ResourceCard({ resource }: { resource: ResourceSummary }) {
  return (
    <Link
      href={`/resources/${resource.id}`}
      className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 text-card-foreground transition hover:border-primary"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{resource.title}</h2>
        {resource.premium && (
          <span className="rounded bg-accent px-2 py-0.5 text-xs text-accent-foreground">Premium</span>
        )}
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
