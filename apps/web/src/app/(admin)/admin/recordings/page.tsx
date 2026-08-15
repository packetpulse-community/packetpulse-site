import { cookies } from "next/headers";
import { adminServerApi } from "@/features/admin/api/admin.api";
import { PendingRecordingsTable } from "@/features/admin/components/PendingRecordingsTable";

export default async function AdminRecordingsPage() {
  const cookieHeader = (await cookies()).toString();
  const pending = await adminServerApi.pendingRecordings(cookieHeader);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Pending Recordings</h1>
      <PendingRecordingsTable data={pending} />
    </div>
  );
}
