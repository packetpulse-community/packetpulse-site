import { cookies } from "next/headers";
import { adminServerApi } from "@/features/admin/api/admin.api";
import { PendingResourcesTable } from "@/features/admin/components/PendingResourcesTable";

export default async function AdminResourcesPage() {
  const cookieHeader = (await cookies()).toString();
  const pending = await adminServerApi.pendingResources(cookieHeader);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Pending Resources</h1>
      <PendingResourcesTable data={pending} />
    </div>
  );
}
