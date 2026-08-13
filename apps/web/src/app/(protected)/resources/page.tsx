import { cookies } from "next/headers";
import { resourcesServerApi } from "@/features/resources/api/resources.api";
import { ResourceCard } from "@/features/resources/components/ResourceCard";

export default async function ResourcesPage() {
  const cookieHeader = (await cookies()).toString();
  const { data: resources } = await resourcesServerApi.list(cookieHeader);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Resources</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        {resources.map((resource) => (
          <ResourceCard key={resource.id} resource={resource} />
        ))}
        {resources.length === 0 && <p className="text-muted-foreground">No resources yet.</p>}
      </div>
    </div>
  );
}
