import Link from "next/link";
import { Badge } from "@/shared/ui/primitives/Badge";
import type { BlogPostSummary } from "../api/blogs.api";

function FeaturedCard({ post, large }: { post: BlogPostSummary; large?: boolean }) {
  return (
    <Link
      href={`/blogs/${post.slug}`}
      className={`rounded-grove-card border border-border bg-surface relative flex overflow-hidden transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring ${large ? "lg:col-span-2 lg:row-span-2 h-72" : "h-40"}`}
    >
      {post.coverImageUrl ? (
        <img src={post.coverImageUrl} alt={post.title} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-primary/30" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-grove-scrim via-grove-scrim/40 to-transparent" />
      <div className="relative mt-auto flex flex-col gap-1 p-4">
        <Badge variant="glass" className="w-fit">
          {post.category.name}
        </Badge>
        <h3 className={`font-semibold text-grove-on-brand ${large ? "text-xl" : "text-sm"} line-clamp-2`}>{post.title}</h3>
        <p className="text-xs text-grove-on-brand/80">
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
