import { cookies } from "next/headers";
import { forumsServerApi } from "@/features/forums/api/forums.api";
import { AdminForumsTable } from "@/features/admin/components/AdminForumsTable";
import { AdminSearchBar } from "@/features/admin/components/AdminSearchBar";
import { Pagination } from "@/shared/components/Pagination";

interface AdminForumsPageProps {
  searchParams: Promise<{ search?: string; page?: string }>;
}

export default async function AdminForumsPage({ searchParams }: AdminForumsPageProps) {
  const params = await searchParams;
  const cookieHeader = (await cookies()).toString();

  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.page) query.set("page", params.page);
  query.set("limit", "50");
  const queryString = `?${query.toString()}`;

  const { data: threads, page, totalPages } = await forumsServerApi.listThreads(cookieHeader, queryString);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Forums</h1>
        <p className="text-muted-foreground">Manage all forum threads — pin, lock, edit, or remove.</p>
      </div>

      <AdminSearchBar basePath="/admin/forums" placeholder="Search threads…" />

      <AdminForumsTable threads={threads} />

      <Pagination page={page} totalPages={totalPages} basePath="/admin/forums" />
    </div>
  );
}
