import Link from "next/link";
import { cardVariants } from "@/shared/ui/primitives/Card";
import { cn } from "@/shared/utils/cn";
import type { BlogPostSummary } from "../api/blogs.api";

export function PostCard({ post }: { post: BlogPostSummary }) {
  return (
    <Link
      href={`/blogs/${post.slug}`}
      className={cn(cardVariants({ variant: "glass" }), "flex flex-col gap-2 p-4")}
    >
      <h2 className="text-lg font-semibold">{post.title}</h2>
      <p className="line-clamp-2 text-sm text-muted-foreground">{post.content}</p>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>
          {post.author.firstName} {post.author.lastName}
        </span>
        <span>·</span>
        <span>{post.category}</span>
        <span>·</span>
        <span>{post._count.likes} likes</span>
        <span>·</span>
        <span>{post._count.comments} comments</span>
      </div>
    </Link>
  );
}
