import { cookies } from "next/headers";
import { blogsServerApi } from "@/features/blogs/api/blogs.api";
import { PostCard } from "@/features/blogs/components/PostCard";
import { BlogFilters } from "@/features/blogs/components/BlogFilters";
import { Pagination } from "@/shared/components/Pagination";

interface BlogsPageProps {
  searchParams: Promise<{ search?: string; category?: string; tag?: string; page?: string }>;
}

export default async function BlogsPage({ searchParams }: BlogsPageProps) {
  const params = await searchParams;
  const cookieHeader = (await cookies()).toString();

  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.category) query.set("category", params.category);
  if (params.tag) query.set("tag", params.tag);
  if (params.page) query.set("page", params.page);
  const queryString = query.toString() ? `?${query.toString()}` : "";

  const { data: posts, page, totalPages } = await blogsServerApi.list(cookieHeader, queryString);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Blogs</h1>
      <BlogFilters />
      <div className="grid gap-4 sm:grid-cols-2">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
        {posts.length === 0 && <p className="text-muted-foreground">No posts yet.</p>}
      </div>
      <Pagination page={page} totalPages={totalPages} basePath="/blogs" />
    </div>
  );
}
