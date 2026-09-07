import { ResourceCard } from "./ResourceCard";
import type { ResourceSummary } from "../api/resources.api";

export function RelatedResources({ resources }: { resources: ResourceSummary[] }) {
  if (resources.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Related Resources</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {resources.map((resource) => (
          <ResourceCard key={resource.id} resource={resource} />
        ))}
      </div>
    </div>
  );
}
