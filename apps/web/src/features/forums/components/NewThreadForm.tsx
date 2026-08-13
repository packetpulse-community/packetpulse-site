"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { forumsClientApi } from "../api/forums.api";
import type { ForumCategory } from "../api/forums.api";

export function NewThreadForm({ categories }: { categories: ForumCategory[] }) {
  const router = useRouter();
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const mutation = useMutation({
    mutationFn: () => forumsClientApi.createThread({ categoryId, title, content }),
    onSuccess: (thread) => {
      router.push(`/forums/${thread.id}`);
      router.refresh();
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (categoryId && title.trim() && content.trim()) mutation.mutate();
      }}
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4"
    >
      <h2 className="text-lg font-semibold">Start a new thread</h2>

      <select
        value={categoryId}
        onChange={(e) => setCategoryId(e.target.value)}
        className="rounded-md border border-input bg-background px-3 py-2"
      >
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Thread title"
        className="rounded-md border border-input bg-background px-3 py-2"
      />

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="What's on your mind?"
        rows={4}
        className="rounded-md border border-input bg-background px-3 py-2"
      />

      <button
        type="submit"
        disabled={mutation.isPending}
        className="w-fit rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
      >
        {mutation.isPending ? "Posting…" : "Post thread"}
      </button>
    </form>
  );
}
