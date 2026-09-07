import { cookies } from "next/headers";
import { blogsServerApi } from "@/features/blogs/api/blogs.api";
import { AdminContentFilters } from "@/features/admin/components/AdminContentFilters";
import { AdminBlogsTable } from "@/features/admin/components/AdminBlogsTable";
import { Pagination } from "@/shared/components/Pagination";

interface AdminBlogsPageProps {
  searchParams: Promise<{ search?: string; category?: string; status?: string; page?: string }>;
}

export default async function AdminBlogsPage({ searchParams }: AdminBlogsPageProps) {
  const params = await searchParams;
  const cookieHeader = (await cookies()).toString();

  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.category) query.set("category", params.category);
  if (params.page) query.set("page", params.page);
  query.set("limit", "50");
  const queryString = `?${query.toString()}`;

  const { data: allPosts, page, totalPages } = await blogsServerApi.list(cookieHeader, queryString);
  const posts = params.status ? allPosts.filter((p) => (params.status === "approved" ? p.isApproved : !p.isApproved)) : allPosts;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Blogs</h1>
        <p className="text-muted-foreground">Manage all blog posts — approve, edit, or remove.</p>
      </div>

      <AdminContentFilters basePath="/admin/blogs" />

      <AdminBlogsTable posts={posts} />

      <Pagination page={page} totalPages={totalPages} basePath="/admin/blogs" />
    </div>
  );
}
