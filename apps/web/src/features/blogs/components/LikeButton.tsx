"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/shared/ui/primitives/Button";
import { blogsClientApi } from "../api/blogs.api";

export function LikeButton({ postId, initialCount }: { postId: string; initialCount: number }) {
  const [liked, setLiked] = useState(false);
  const [count, setCount] = useState(initialCount);

  const mutation = useMutation({
    mutationFn: () => blogsClientApi.toggleLike(postId),
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
