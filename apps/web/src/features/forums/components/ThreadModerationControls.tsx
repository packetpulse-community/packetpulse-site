"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/shared/auth/AuthProvider";
import { Button } from "@/shared/ui/primitives/Button";
import { forumsClientApi } from "../api/forums.api";

export function ThreadModerationControls({
  threadId,
  isLocked,
  isPinned,
}: {
  threadId: string;
  isLocked: boolean;
  isPinned: boolean;
}) {
  const router = useRouter();
  const auth = useAuth();
  const isSuperAdmin = auth?.roles.includes("super_admin") ?? false;
  const canModerate = isSuperAdmin || (auth?.permissions.includes("forums:moderate") ?? false);

  const lockMutation = useMutation({
    mutationFn: () => (isLocked ? forumsClientApi.unlockThread(threadId) : forumsClientApi.lockThread(threadId)),
    onSuccess: () => {
      toast.success(isLocked ? "Thread unlocked" : "Thread locked");
      router.refresh();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not update thread"),
  });

  const pinMutation = useMutation({
    mutationFn: () => (isPinned ? forumsClientApi.unpinThread(threadId) : forumsClientApi.pinThread(threadId)),
    onSuccess: () => {
      toast.success(isPinned ? "Thread unpinned" : "Thread pinned");
      router.refresh();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not update thread"),
  });

  if (!canModerate) return null;

  return (
    <div className="flex items-center gap-2">
      <Button variant="glass" size="sm" onClick={() => lockMutation.mutate()} disabled={lockMutation.isPending}>
        {isLocked ? "Unlock" : "Lock"}
      </Button>
      <Button variant="glass" size="sm" onClick={() => pinMutation.mutate()} disabled={pinMutation.isPending}>
        {isPinned ? "Unpin" : "Pin"}
      </Button>
    </div>
  );
}
