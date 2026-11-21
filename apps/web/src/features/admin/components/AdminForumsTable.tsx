"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card } from "@/shared/ui/primitives/Card";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Button } from "@/shared/ui/primitives/Button";
import { forumsClientApi, type ForumThreadSummary } from "@/features/forums/api/forums.api";
import { ReasonDialog } from "@/features/forums/components/ReasonDialog";
import { ForumThreadEditForm } from "./ForumThreadEditForm";
import { EmptyState } from "@/shared/ui/primitives/EmptyState";

export function AdminForumsTable({ threads }: { threads: ForumThreadSummary[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<ForumThreadSummary | null>(null);
  
  // Pin, lock and delete on someone else's thread need a written reason (PRD-028, audited).
  const [acting, setActing] = useState<{ thread: ForumThreadSummary; action: "pin" | "lock" | "delete" } | null>(null);

  async function decide(reason: string) {
    if (!acting) return;
    const { thread: t, action } = acting;
    if (action === "pin") await (t.isPinned ? forumsClientApi.unpinThread(t.id, reason) : forumsClientApi.pinThread(t.id, reason));
    if (action === "lock") await (t.isLocked ? forumsClientApi.unlockThread(t.id, reason) : forumsClientApi.lockThread(t.id, reason));
    if (action === "delete") await forumsClientApi.deleteThread(t.id, reason);
    toast.success(action === "delete" ? "Thread removed. The author was told why." : "Saved");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        {threads.map((thread) => (
          <Card key={thread.id} variant="glass" className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <p className="font-medium">{thread.title}</p>
                {thread.isPinned && <Badge variant="secondary">Pinned</Badge>}
                {thread.isLocked && <Badge variant="warning">Locked</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">
                {thread.category.name} · {thread.author.firstName} {thread.author.lastName} · {thread._count.replies} replies
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="glass" size="sm" onClick={() => setActing({ thread, action: "pin" })}>
                {thread.isPinned ? "Unpin" : "Pin"}
              </Button>
              <Button variant="glass" size="sm" onClick={() => setActing({ thread, action: "lock" })}>
                {thread.isLocked ? "Unlock" : "Lock"}
              </Button>
              <Button variant="glass" size="sm" onClick={() => setEditing(thread)}>
                Edit
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setActing({ thread, action: "delete" })}>
                Delete
              </Button>
            </div>
          </Card>
        ))}
        {threads.length === 0 && (
          <EmptyState
            title="No threads yet"
            description="Threads started by members appear here for moderation."
            action={{ label: "Open the forum", href: "/forums" }}
          />
        )}
      </div>

      {editing && <ForumThreadEditForm thread={editing} open={true} onClose={() => setEditing(null)} />}

      {acting && (
        <ReasonDialog
          open
          onClose={() => setActing(null)}
          title={acting.action === "delete" ? "Remove thread" : acting.action === "pin" ? (acting.thread.isPinned ? "Unpin thread" : "Pin thread") : acting.thread.isLocked ? "Unlock thread" : "Lock thread"}
          description={acting.action === "delete" ? `Remove "${acting.thread.title}". Its author is told the reason and loses the reputation it earned.` : "The reason goes to the audit log."}
          confirmLabel={acting.action === "delete" ? "Remove" : "Confirm"}
          destructive={acting.action === "delete"}
          onConfirm={decide}
        />
      )}
    </div>
  );
}
