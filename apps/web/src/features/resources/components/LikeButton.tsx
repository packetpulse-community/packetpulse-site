"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { resourcesClientApi } from "../api/resources.api";

export function ResourceLikeButton({ resourceId, initialCount }: { resourceId: string; initialCount: number }) {
  const [liked, setLiked] = useState(false);
  const [count, setCount] = useState(initialCount);

  const mutation = useMutation({
    mutationFn: () => resourcesClientApi.toggleLike(resourceId),
    onSuccess: (res) => {
      setLiked(res.liked);
      setCount((c) => c + (res.liked ? 1 : -1));
    },
  });

  return (
    <button
      onClick={() => mutation.mutate()}
      disabled={mutation.isPending}
      className="rounded-md border border-border px-3 py-1 text-sm hover:border-primary disabled:opacity-50"
    >
      {liked ? "♥" : "♡"} {count}
    </button>
  );
}
