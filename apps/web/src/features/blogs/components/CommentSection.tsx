"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { blogsClientApi } from "../api/blogs.api";
import type { BlogComment } from "../api/blogs.api";

export function CommentSection({ postId, initialComments }: { postId: string; initialComments: BlogComment[] }) {
  const [content, setContent] = useState("");
  const router = useRouter();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => blogsClientApi.addComment(postId, { content }),
    onSuccess: () => {
      setContent("");
      // Server Component data isn't in the React Query cache — re-fetch the RSC
      // payload so the new comment appears without a full reload.
      router.refresh();
      queryClient.invalidateQueries({ queryKey: ["blog-post", postId] });
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Comments ({initialComments.length})</h2>

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
          placeholder="Add a comment…"
          className="flex-1 rounded-md border border-input bg-background px-3 py-2"
        />
        <button
          type="submit"
          disabled={mutation.isPending}
          className="rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
        >
          Post
        </button>
      </form>

      <ul className="flex flex-col gap-3">
        {initialComments.map((comment) => (
          <li key={comment.id} className="rounded-md border border-border p-3">
            <p className="text-sm">{comment.content}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {comment.user.firstName} {comment.user.lastName}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
