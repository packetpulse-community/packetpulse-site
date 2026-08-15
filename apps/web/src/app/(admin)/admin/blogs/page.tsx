import { cookies } from "next/headers";
import { adminServerApi } from "@/features/admin/api/admin.api";
import { PendingBlogsTable } from "@/features/admin/components/PendingBlogsTable";

export default async function AdminBlogsPage() {
  const cookieHeader = (await cookies()).toString();
  const pending = await adminServerApi.pendingBlogs(cookieHeader);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Pending Blog Posts</h1>
      <PendingBlogsTable data={pending} />
    </div>
  );
}
