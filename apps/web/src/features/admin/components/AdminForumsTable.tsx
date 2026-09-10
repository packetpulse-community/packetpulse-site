"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card } from "@/shared/ui/primitives/Card";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Button } from "@/shared/ui/primitives/Button";
import { Dialog } from "@/shared/ui/primitives/Dialog";
import { forumsClientApi, type ForumThreadSummary } from "@/features/forums/api/forums.api";
import { ForumThreadEditForm } from "./ForumThreadEditForm";

export function AdminForumsTable({ threads }: { threads: ForumThreadSummary[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<ForumThreadSummary | null>(null);
  const [deleting, setDeleting] = useState<ForumThreadSummary | null>(null);

  const pinMutation = useMutation({
    mutationFn: (t: ForumThreadSummary) => (t.isPinned ? forumsClientApi.unpinThread(t.id) : forumsClientApi.pinThread(t.id)),
    onSuccess: (_, t) => {
      toast.success(t.isPinned ? "Thread unpinned" : "Thread pinned");
      router.refresh();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not update thread"),
  });

  const lockMutation = useMutation({
    mutationFn: (t: ForumThreadSummary) => (t.isLocked ? forumsClientApi.unlockThread(t.id) : forumsClientApi.lockThread(t.id)),
    onSuccess: (_, t) => {
      toast.success(t.isLocked ? "Thread unlocked" : "Thread locked");
      router.refresh();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not update thread"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => forumsClientApi.deleteThread(id),
    onSuccess: () => {
      toast.success("Thread deleted");
      router.refresh();
      setDeleting(null);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not delete thread"),
  });

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
              <Button variant="glass" size="sm" onClick={() => pinMutation.mutate(thread)} disabled={pinMutation.isPending}>
                {thread.isPinned ? "Unpin" : "Pin"}
              </Button>
              <Button variant="glass" size="sm" onClick={() => lockMutation.mutate(thread)} disabled={lockMutation.isPending}>
                {thread.isLocked ? "Unlock" : "Lock"}
              </Button>
              <Button variant="glass" size="sm" onClick={() => setEditing(thread)}>
                Edit
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setDeleting(thread)}>
                Delete
              </Button>
            </div>
          </Card>
        ))}
        {threads.length === 0 && <p className="text-muted-foreground">No threads found.</p>}
      </div>

      {editing && <ForumThreadEditForm thread={editing} open={true} onClose={() => setEditing(null)} />}

      <Dialog open={!!deleting} onClose={() => setDeleting(null)} title="Delete thread" description="This action cannot be undone.">
        <p className="text-sm text-muted-foreground">
          Delete <span className="font-medium text-foreground">{deleting?.title}</span> and all its replies?
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDeleting(null)} disabled={deleteMutation.isPending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={() => deleting && deleteMutation.mutate(deleting.id)} disabled={deleteMutation.isPending}>
            {deleteMutation.isPending ? "Deleting…" : "Delete"}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
