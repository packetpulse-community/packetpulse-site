import { cookies } from "next/headers";
import { resourcesServerApi } from "@/features/resources/api/resources.api";
import { ResourceCard } from "@/features/resources/components/ResourceCard";
import { ResourceFilters } from "@/features/resources/components/ResourceFilters";
import { Pagination } from "@/shared/components/Pagination";

interface ResourcesPageProps {
  searchParams: Promise<{ search?: string; category?: string; resourceType?: string; tag?: string; page?: string }>;
}

export default async function ResourcesPage({ searchParams }: ResourcesPageProps) {
  const params = await searchParams;
  const cookieHeader = (await cookies()).toString();

  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.category) query.set("category", params.category);
  if (params.resourceType) query.set("resourceType", params.resourceType);
  if (params.tag) query.set("tag", params.tag);
  if (params.page) query.set("page", params.page);
  const queryString = query.toString() ? `?${query.toString()}` : "";

  const { data: resources, page, totalPages } = await resourcesServerApi.list(cookieHeader, queryString);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Resources</h1>
      <ResourceFilters />
      <div className="grid gap-4 sm:grid-cols-2">
        {resources.map((resource) => (
          <ResourceCard key={resource.id} resource={resource} />
        ))}
        {resources.length === 0 && <p className="text-muted-foreground">No resources yet.</p>}
      </div>
      <Pagination page={page} totalPages={totalPages} basePath="/resources" />
    </div>
  );
}
