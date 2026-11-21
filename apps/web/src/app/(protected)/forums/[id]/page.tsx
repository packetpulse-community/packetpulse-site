import { cookies } from "next/headers";
import Link from "next/link";
import { forumsServerApi } from "@/features/forums/api/forums.api";
import { ReplySection } from "@/features/forums/components/ReplySection";
import { ThreadModerationControls } from "@/features/forums/components/ThreadModerationControls";
import { ThreadReportButton } from "@/features/forums/components/ThreadReportButton";
import { ReputationLine } from "@/features/forums/components/ReputationLine";
import { Badge } from "@/shared/ui/primitives/Badge";
import { FORUM_MODE_LABELS } from "@packetpulse/types";

export default async function ThreadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieHeader = (await cookies()).toString();
  const thread = await forumsServerApi.getThread(id, cookieHeader);

  return (
    <article className="flex flex-col gap-6">
      <Link href="/forums" className="text-sm text-muted-foreground hover:text-primary">
        ← Back to forums
      </Link>

      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">{thread.title}</h1>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <Badge variant="outline">{FORUM_MODE_LABELS[thread.mode]}</Badge>
          {thread.acceptedReplyId && <Badge variant="success">✓ Answered</Badge>}
          <span>{thread.category.name}</span>
          <span>·</span>
          <span>
            {thread.author.firstName} {thread.author.lastName}
          </span>
          <ReputationLine reputation={thread.author.reputation} />
          <span>·</span>
          <span>{thread.viewCount} views</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ThreadReportButton threadId={thread.id} authorId={thread.author.id} />
          <ThreadModerationControls threadId={thread.id} authorId={thread.author.id} isLocked={thread.isLocked} isPinned={thread.isPinned} />
        </div>
      </header>

      <p className="whitespace-pre-wrap text-base leading-relaxed">{thread.content}</p>

      <ReplySection threadId={thread.id} threadAuthorId={thread.author.id} replies={thread.replies} isLocked={thread.isLocked} />
    </article>
  );
}
