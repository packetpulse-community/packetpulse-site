import { cookies } from "next/headers";
import { adminServerApi } from "@/features/admin/api/admin.api";
import { ResourceApproveButton } from "@/features/admin/components/ResourceApproveButton";

export default async function AdminResourcesPage() {
  const cookieHeader = (await cookies()).toString();
  const pending = await adminServerApi.pendingResources(cookieHeader);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Pending Resources</h1>
      <div className="flex flex-col gap-2">
        {pending.map((resource) => (
          <div key={resource.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
            <div>
              <p className="font-medium">{resource.title}</p>
              <p className="text-sm text-muted-foreground">
                {resource.resourceType} · {resource.user.firstName} {resource.user.lastName}
              </p>
            </div>
            <ResourceApproveButton resourceId={resource.id} />
          </div>
        ))}
        {pending.length === 0 && <p className="text-muted-foreground">Nothing pending.</p>}
      </div>
    </div>
  );
}
