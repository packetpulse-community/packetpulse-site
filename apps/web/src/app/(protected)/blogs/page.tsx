import Link from "next/link";
import { cookies } from "next/headers";
import { blogsServerApi } from "@/features/blogs/api/blogs.api";
import { PostCard } from "@/features/blogs/components/PostCard";
import { FeaturedPosts } from "@/features/blogs/components/FeaturedPosts";
import { BlogFilters } from "@/features/blogs/components/BlogFilters";
import { Pagination } from "@/shared/components/Pagination";
import { CalloutBox } from "@/shared/components/CalloutBox";
import { buttonVariants } from "@/shared/ui/primitives/Button";
import { cn } from "@/shared/utils/cn";

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

  const isFiltered = Boolean(params.search || params.category || params.tag || params.page);
  const [{ data: posts, page, totalPages }, featured] = await Promise.all([
    blogsServerApi.list(cookieHeader, queryString),
    isFiltered ? Promise.resolve([]) : blogsServerApi.featured(cookieHeader),
  ]);

  const availableTags = Array.from(new Set(posts.flatMap((p) => p.tags.map((t) => t.tag))));

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-3xl font-semibold">Network Engineering Insights</h1>
        <p className="text-muted-foreground">
          Expert articles, tutorials, and discussions about network engineering, troubleshooting, and industry best
          practices.
        </p>
      </div>

      {!isFiltered && <FeaturedPosts posts={featured} />}

      <BlogFilters availableTags={availableTags} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
        {posts.length === 0 && <p className="text-muted-foreground">No posts yet.</p>}
      </div>

      <Pagination page={page} totalPages={totalPages} basePath="/blogs" />

      <CalloutBox
        title="Share Your Knowledge"
        description="Are you a networking professional with insights to share? Join our community and contribute to our collection of articles."
      >
        <Link href="/contact" className={cn(buttonVariants({ variant: "gradient" }))}>
          Become a Contributor →
        </Link>
      </CalloutBox>
    </div>
  );
}
