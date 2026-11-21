"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/shared/auth/AuthProvider";
import { Button } from "@/shared/ui/primitives/Button";
import { forumsClientApi } from "../api/forums.api";
import { ReasonDialog } from "./ReasonDialog";

type Action = "lock" | "pin" | "remove";

export function ThreadModerationControls({
  threadId,
  authorId,
  isLocked,
  isPinned,
}: {
  threadId: string;
  authorId: string;
  isLocked: boolean;
  isPinned: boolean;
}) {
  const router = useRouter();
  const auth = useAuth();
  const [action, setAction] = useState<Action | null>(null);
  const isSuperAdmin = auth?.roles.includes("super_admin") ?? false;
  const canModerate = isSuperAdmin || (auth?.permissions.includes("forums:moderate") ?? false);
  if (!canModerate) return null;
  const own = auth?.id === authorId;

  // Acting on someone else's thread needs a written reason (PRD-028); on your own thread it does not.
  async function run(a: Action, reason?: string) {
    if (a === "lock") await (isLocked ? forumsClientApi.unlockThread(threadId, reason) : forumsClientApi.lockThread(threadId, reason));
    if (a === "pin") await (isPinned ? forumsClientApi.unpinThread(threadId, reason) : forumsClientApi.pinThread(threadId, reason));
    if (a === "remove") {
      await forumsClientApi.deleteThread(threadId, reason);
      toast.success("Thread removed. The author was told why.");
      router.push("/forums");
    } else {
      toast.success("Saved");
    }
    router.refresh();
  }
  const start = (a: Action) => {
    if (own && a !== "remove") run(a).catch((e) => toast.error(e instanceof Error ? e.message : "Could not update thread"));
    else setAction(a);
  };

  const titles: Record<Action, string> = {
    lock: isLocked ? "Unlock this thread" : "Lock this thread",
    pin: isPinned ? "Unpin this thread" : "Pin this thread",
    remove: "Remove this thread",
  };

  return (
    <div className="flex items-center gap-2">
      <Button variant="glass" size="sm" onClick={() => start("lock")}>
        {isLocked ? "Unlock" : "Lock"}
      </Button>
      <Button variant="glass" size="sm" onClick={() => start("pin")}>
        {isPinned ? "Unpin" : "Pin"}
      </Button>
      <Button variant="glass" size="sm" onClick={() => setAction("remove")}>
        Remove
      </Button>
      {action && (
        <ReasonDialog
          open
          onClose={() => setAction(null)}
          title={titles[action]}
          description={action === "remove" ? "The author is told this reason and loses the reputation this thread earned." : "The reason goes to the audit log."}
          confirmLabel={action === "remove" ? "Remove" : "Confirm"}
          destructive={action === "remove"}
          onConfirm={(reason) => run(action, reason)}
        />
      )}
    </div>
  );
}
