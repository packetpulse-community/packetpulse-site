import { cookies } from "next/headers";
import { blogsServerApi } from "@/features/blogs/api/blogs.api";
import { PostCard } from "@/features/blogs/components/PostCard";

export default async function BlogsPage() {
  const cookieHeader = (await cookies()).toString();
  const { data: posts } = await blogsServerApi.list(cookieHeader);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Blogs</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
        {posts.length === 0 && <p className="text-muted-foreground">No posts yet.</p>}
      </div>
    </div>
  );
}
