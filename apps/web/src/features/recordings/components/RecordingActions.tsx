"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/shared/ui/primitives/Button";
import { recordingsClientApi } from "../api/recordings.api";

export function RecordingActions({ recordingId, initialLikes }: { recordingId: string; initialLikes: number }) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(initialLikes);
  const [joined, setJoined] = useState(false);

  const likeMutation = useMutation({
    mutationFn: () => recordingsClientApi.toggleLike(recordingId),
    onSuccess: (res) => {
      setLiked(res.liked);
      setLikeCount((c) => c + (res.liked ? 1 : -1));
    },
  });

  const joinMutation = useMutation({
    mutationFn: () => recordingsClientApi.join(recordingId),
    onSuccess: () => setJoined(true),
  });

  return (
    <div className="flex items-center gap-2">
      <Button variant="glass" size="sm" onClick={() => likeMutation.mutate()} disabled={likeMutation.isPending}>
        {liked ? "♥" : "♡"} {likeCount}
      </Button>
      <Button variant="glass" size="sm" onClick={() => joinMutation.mutate()} disabled={joinMutation.isPending || joined}>
        {joined ? "Joined" : "Join session"}
      </Button>
    </div>
  );
}
