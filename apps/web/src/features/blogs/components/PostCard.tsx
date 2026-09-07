import Link from "next/link";
import { Calendar, Clock, MessageSquare, ThumbsUp, User } from "lucide-react";
import { cardVariants } from "@/shared/ui/primitives/Card";
import { Badge } from "@/shared/ui/primitives/Badge";
import { cn } from "@/shared/utils/cn";
import { estimateReadTime } from "@/shared/utils/readTime";
import type { BlogPostSummary } from "../api/blogs.api";

export function PostCard({ post }: { post: BlogPostSummary }) {
  return (
    <Link href={`/blogs/${post.slug}`} className={cn(cardVariants({ variant: "glass" }), "flex flex-col overflow-hidden")}>
      {post.coverImageUrl && (
        <div className="h-48 w-full overflow-hidden">
          <img src={post.coverImageUrl} alt={post.title} className="h-full w-full object-cover" />
        </div>
      )}
      <div className="flex flex-col gap-2 p-4">
        <div className="flex items-center justify-between">
          <Badge variant="glass">{post.category}</Badge>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {estimateReadTime(post.content)} min read
          </span>
        </div>
        <h2 className="line-clamp-2 text-lg font-semibold">{post.title}</h2>
        <p className="line-clamp-3 text-sm text-muted-foreground">{post.content}</p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <User className="h-3 w-3" />
            {post.author.firstName} {post.author.lastName}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {new Date(post.postedAt).toLocaleDateString()}
          </span>
        </div>
        <div className="flex items-center gap-3 border-t border-glass-border pt-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <ThumbsUp className="h-3 w-3" />
            {post._count.likes}
          </span>
          <span className="flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            {post._count.comments}
          </span>
        </div>
      </div>
    </Link>
  );
}
