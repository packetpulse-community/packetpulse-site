import { cookies } from "next/headers";
import { adminServerApi } from "@/features/admin/api/admin.api";
import { SystemStatusPanel } from "@/features/admin/components/SystemStatusPanel";

export default async function AdminSystemStatusPage() {
  const cookieHeader = (await cookies()).toString();
  const status = await adminServerApi.status(cookieHeader);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">System Status</h1>
        <p className="text-muted-foreground">Live diagnostics for the API server and database.</p>
      </div>
      <SystemStatusPanel initialStatus={status} />
    </div>
  );
}
