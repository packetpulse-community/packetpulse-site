"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
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
      <button
        onClick={() => likeMutation.mutate()}
        disabled={likeMutation.isPending}
        className="rounded-md border border-border px-3 py-1 text-sm hover:border-primary disabled:opacity-50"
      >
        {liked ? "♥" : "♡"} {likeCount}
      </button>
      <button
        onClick={() => joinMutation.mutate()}
        disabled={joinMutation.isPending || joined}
        className="rounded-md border border-border px-3 py-1 text-sm hover:border-primary disabled:opacity-50"
      >
        {joined ? "Joined" : "Join session"}
      </button>
    </div>
  );
}
