"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/shared/auth/AuthProvider";
import { cn } from "@/shared/utils/cn";
import { Button, buttonVariants } from "@/shared/ui/primitives/Button";
import { forumsClientApi } from "../api/forums.api";
import type { ForumReply } from "../api/forums.api";

function ReplyLikeButton({ replyId, initialCount }: { replyId: string; initialCount: number }) {
  const [liked, setLiked] = useState(false);
  const [count, setCount] = useState(initialCount);

  const mutation = useMutation({
    mutationFn: () => forumsClientApi.toggleReplyLike(replyId),
    onSuccess: (res) => {
      setLiked(res.liked);
      setCount((c) => c + (res.liked ? 1 : -1));
    },
  });

  return (
    <Button variant="glass" size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
      {liked ? "♥" : "♡"} {count}
    </Button>
  );
}

function ReplyItem({ threadId, reply, canDelete }: { threadId: string; reply: ForumReply; canDelete: boolean }) {
  const router = useRouter();

  const deleteMutation = useMutation({
    mutationFn: () => forumsClientApi.deleteReply(threadId, reply.id),
    onSuccess: () => {
      toast.success("Reply deleted");
      router.refresh();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not delete reply"),
  });

  return (
    <li className="glass-panel rounded-md p-3">
      <p className="text-sm">{reply.content}</p>
      <div className="mt-2 flex items-center gap-3">
        <p className="text-xs text-muted-foreground">
          {reply.author.firstName} {reply.author.lastName}
        </p>
        <ReplyLikeButton replyId={reply.id} initialCount={reply._count.likes} />
        {canDelete && (
          <Button variant="glass" size="sm" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
            Delete
          </Button>
        )}
      </div>
    </li>
  );
}

export function ReplySection({ threadId, replies, isLocked }: { threadId: string; replies: ForumReply[]; isLocked: boolean }) {
  const [content, setContent] = useState("");
  const router = useRouter();
  const auth = useAuth();
  const isSuperAdmin = auth?.roles.includes("super_admin") ?? false;
  const isModerator = isSuperAdmin || auth?.roles.includes("admin") || auth?.roles.includes("moderator") || false;

  const mutation = useMutation({
    mutationFn: () => forumsClientApi.addReply(threadId, content),
    onSuccess: () => {
      setContent("");
      router.refresh();
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Replies ({replies.length})</h2>

      {!isLocked ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (content.trim()) mutation.mutate();
          }}
          className="glass-panel flex gap-2 rounded-lg p-3"
        >
          <input
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write a reply…"
            className="flex-1 rounded-md border border-input bg-background px-3 py-2"
          />
          <button type="submit" disabled={mutation.isPending} className={cn(buttonVariants({ variant: "gradient" }))}>
            Reply
          </button>
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">This thread is locked.</p>
      )}

      <ul className="flex flex-col gap-3">
        {replies.map((reply) => (
          <ReplyItem
            key={reply.id}
            threadId={threadId}
            reply={reply}
            canDelete={isModerator || reply.author.id === auth?.id}
          />
        ))}
      </ul>
    </div>
  );
}
