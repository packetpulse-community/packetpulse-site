import Link from "next/link";
import { cookies } from "next/headers";
import { resourcesServerApi } from "@/features/resources/api/resources.api";
import { ResourceCard } from "@/features/resources/components/ResourceCard";
import { ResourceFilters } from "@/features/resources/components/ResourceFilters";
import { Pagination } from "@/shared/components/Pagination";
import { CalloutBox } from "@/shared/components/CalloutBox";
import { buttonVariants } from "@/shared/ui/primitives/Button";
import { cn } from "@/shared/utils/cn";

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
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-3xl font-semibold">Resource Library</h1>
        <p className="text-muted-foreground">
          Curated guides, tools, and reference material contributed by the networking community.
        </p>
      </div>

      <ResourceFilters />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {resources.map((resource) => (
          <ResourceCard key={resource.id} resource={resource} />
        ))}
        {resources.length === 0 && <p className="text-muted-foreground">No resources yet.</p>}
      </div>

      <Pagination page={page} totalPages={totalPages} basePath="/resources" />

      <CalloutBox
        title="Share a Resource"
        description="Have a guide, tool, or reference sheet worth sharing? Contribute it to the library so other members can find it."
      >
        <Link href="/contact" className={cn(buttonVariants({ variant: "gradient" }))}>
          Contribute a Resource →
        </Link>
      </CalloutBox>
    </div>
  );
}
