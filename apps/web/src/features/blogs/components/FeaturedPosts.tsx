import Link from "next/link";
import { Badge } from "@/shared/ui/primitives/Badge";
import type { BlogPostSummary } from "../api/blogs.api";

function FeaturedCard({ post, large }: { post: BlogPostSummary; large?: boolean }) {
  return (
    <Link
      href={`/blogs/${post.slug}`}
      className={`glass-panel glass-interactive relative flex overflow-hidden rounded-lg ${large ? "lg:col-span-2 lg:row-span-2 h-72" : "h-40"}`}
    >
      {post.coverImageUrl ? (
        <img src={post.coverImageUrl} alt={post.title} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/60 to-purple-900/60" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent" />
      <div className="relative mt-auto flex flex-col gap-1 p-4">
        <Badge variant="glass" className="w-fit">
          {post.category}
        </Badge>
        <h3 className={`font-semibold text-white ${large ? "text-xl" : "text-sm"} line-clamp-2`}>{post.title}</h3>
        <p className="text-xs text-gray-300">
          {post.author.firstName} {post.author.lastName} · {new Date(post.postedAt).toLocaleDateString()}
        </p>
      </div>
    </Link>
  );
}

export function FeaturedPosts({ posts }: { posts: BlogPostSummary[] }) {
  if (posts.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">Featured Articles</h2>
      <div className="grid gap-4 lg:grid-cols-3">
        {posts.map((post, index) => (
          <FeaturedCard key={post.id} post={post} large={index === 0} />
        ))}
      </div>
    </div>
  );
}
