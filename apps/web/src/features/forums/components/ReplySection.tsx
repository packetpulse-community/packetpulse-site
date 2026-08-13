"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { forumsClientApi } from "../api/forums.api";
import type { ForumReply } from "../api/forums.api";

export function ReplySection({ threadId, replies, isLocked }: { threadId: string; replies: ForumReply[]; isLocked: boolean }) {
  const [content, setContent] = useState("");
  const router = useRouter();

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
          className="flex gap-2"
        >
          <input
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write a reply…"
            className="flex-1 rounded-md border border-input bg-background px-3 py-2"
          />
          <button
            type="submit"
            disabled={mutation.isPending}
            className="rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
          >
            Reply
          </button>
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">This thread is locked.</p>
      )}

      <ul className="flex flex-col gap-3">
        {replies.map((reply) => (
          <li key={reply.id} className="rounded-md border border-border p-3">
            <p className="text-sm">{reply.content}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {reply.author.firstName} {reply.author.lastName} · {reply._count.likes} likes
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
