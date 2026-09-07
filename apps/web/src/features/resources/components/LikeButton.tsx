"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/shared/ui/primitives/Button";
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
    <Button variant="glass" size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
      {liked ? "♥" : "♡"} {count}
    </Button>
  );
}
