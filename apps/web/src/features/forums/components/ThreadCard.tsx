import Link from "next/link";
import type { ForumThreadSummary } from "../api/forums.api";

export function ThreadCard({ thread }: { thread: ForumThreadSummary }) {
  return (
    <Link
      href={`/forums/${thread.id}`}
      className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4 text-card-foreground transition hover:border-primary"
    >
      <div className="flex items-center gap-2">
        {thread.isPinned && <span className="text-xs text-primary">📌 Pinned</span>}
        {thread.isLocked && <span className="text-xs text-muted-foreground">🔒 Locked</span>}
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
