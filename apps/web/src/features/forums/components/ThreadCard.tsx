import Link from "next/link";
import { cardVariants } from "@/shared/ui/primitives/Card";
import { Badge } from "@/shared/ui/primitives/Badge";
import { cn } from "@/shared/utils/cn";
import type { ForumThreadSummary } from "../api/forums.api";

export function ThreadCard({ thread }: { thread: ForumThreadSummary }) {
  return (
    <Link href={`/forums/${thread.id}`} className={cn(cardVariants({ variant: "glass" }), "flex flex-col gap-1 p-4")}>
      <div className="flex items-center gap-2">
        {thread.isPinned && <Badge variant="glass">📌 Pinned</Badge>}
        {thread.isLocked && <Badge variant="glass">🔒 Locked</Badge>}
        <h2 className="text-lg font-semibold">{thread.title}</h2>
      </div>
      <p className="line-clamp-1 text-sm text-muted-foreground">{thread.content}</p>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>{thread.category.name}</span>
        <span>·</span>
        <span>
          {thread.author.firstName} {thread.author.lastName}
        </span>
        <span>·</span>
        <span>{thread._count.replies} replies</span>
      </div>
    </Link>
  );
}
