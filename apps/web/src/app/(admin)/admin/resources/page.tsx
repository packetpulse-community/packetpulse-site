import { cookies } from "next/headers";
import { resourcesServerApi } from "@/features/resources/api/resources.api";
import { AdminContentFilters } from "@/features/admin/components/AdminContentFilters";
import { AdminResourcesTable } from "@/features/admin/components/AdminResourcesTable";
import { Pagination } from "@/shared/components/Pagination";

const RESOURCE_TYPES = ["pdf", "video", "article", "tutorial", "diagram", "config_template", "tool", "external_link"] as const;

interface AdminResourcesPageProps {
  searchParams: Promise<{
    search?: string;
    category?: string;
    resourceType?: string;
    status?: string;
    page?: string;
  }>;
}

export default async function AdminResourcesPage({ searchParams }: AdminResourcesPageProps) {
  const params = await searchParams;
  const cookieHeader = (await cookies()).toString();

  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.category) query.set("category", params.category);
  if (params.resourceType) query.set("resourceType", params.resourceType);
  if (params.page) query.set("page", params.page);
  query.set("limit", "50");
  const queryString = `?${query.toString()}`;

  const { data: allResources, page, totalPages } = await resourcesServerApi.list(cookieHeader, queryString);
  const resources = params.status
    ? allResources.filter((r) => (params.status === "approved" ? r.isApproved : !r.isApproved))
    : allResources;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Resources</h1>
        <p className="text-muted-foreground">Manage all resources — approve, edit, or remove.</p>
      </div>

      <AdminContentFilters basePath="/admin/resources" typeOptions={RESOURCE_TYPES} typeParam="resourceType" />

      <AdminResourcesTable resources={resources} />

      <Pagination page={page} totalPages={totalPages} basePath="/admin/resources" />
    </div>
  );
}
