import { cookies } from "next/headers";
import { recordingsServerApi } from "@/features/recordings/api/recordings.api";
import { AdminContentFilters } from "@/features/admin/components/AdminContentFilters";
import { AdminRecordingsTable } from "@/features/admin/components/AdminRecordingsTable";
import { Pagination } from "@/shared/components/Pagination";

interface AdminRecordingsPageProps {
  searchParams: Promise<{ search?: string; category?: string; status?: string; page?: string }>;
}

export default async function AdminRecordingsPage({ searchParams }: AdminRecordingsPageProps) {
  const params = await searchParams;
  const cookieHeader = (await cookies()).toString();

  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.category) query.set("category", params.category);
  if (params.page) query.set("page", params.page);
  query.set("limit", "50");
  const queryString = `?${query.toString()}`;

  const { data: allRecordings, page, totalPages } = await recordingsServerApi.list(cookieHeader, queryString);
  const recordings = params.status
    ? allRecordings.filter((r) => (params.status === "approved" ? r.isApproved : !r.isApproved))
    : allRecordings;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Recordings</h1>
        <p className="text-muted-foreground">Manage all recordings — approve, edit, or remove.</p>
      </div>

      <AdminContentFilters basePath="/admin/recordings" />

      <AdminRecordingsTable recordings={recordings} />

      <Pagination page={page} totalPages={totalPages} basePath="/admin/recordings" />
    </div>
  );
}
