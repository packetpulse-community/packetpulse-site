"use client";

import { useId, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/shared/auth/AuthProvider";
import { cn } from "@/shared/utils/cn";
import { Button, buttonVariants } from "@/shared/ui/primitives/Button";
import { Badge } from "@/shared/ui/primitives/Badge";
import { useFeatureFlag } from "@/features/feature-flags/hooks/useFeatureFlags";
import { forumErrorMessage, forumsClientApi } from "../api/forums.api";
import type { ForumReply } from "../api/forums.api";
import { GUIDELINES_STATUS_KEY } from "./NewThreadForm";
import { ReasonDialog } from "./ReasonDialog";
import { ReportDialog } from "./ReportDialog";
import { ReputationLine } from "./ReputationLine";

function ReplyLikeButton({ replyId, initialCount, disabled }: { replyId: string; initialCount: number; disabled: boolean }) {
  const [liked, setLiked] = useState(false);
  const [count, setCount] = useState(initialCount);
  const mutation = useMutation({
    mutationFn: () => forumsClientApi.toggleReplyLike(replyId),
    onSuccess: (res) => {
      setLiked(res.liked);
      setCount((c) => c + (res.liked ? 1 : -1));
    },
    onError: (err) => toast.error(forumErrorMessage(err, "Could not save your vote")),
  });
  return (
    <Button
      variant="glass"
      size="sm"
      onClick={() => mutation.mutate()}
      disabled={mutation.isPending || disabled}
      aria-pressed={liked}
      aria-label={`${liked ? "Remove helpful vote" : "Mark helpful"}, ${count} ${count === 1 ? "vote" : "votes"}`}
      title={disabled ? "You cannot vote for your own reply" : undefined}
    >
      {liked ? "♥ Helpful" : "♡ Helpful"} {count}
    </Button>
  );
}

function ReplyItem({
  threadId,
  reply,
  isOwner,
  canAccept,
  isModerator,
  signedIn,
}: {
  threadId: string;
  reply: ForumReply;
  isOwner: boolean;
  canAccept: boolean;
  isModerator: boolean;
  signedIn: boolean;
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<null | "report" | "remove" | "accept">(null);

  const acceptMutation = useMutation({
    mutationFn: async (reason?: string) => {
      if (reply.isAccepted) await forumsClientApi.unacceptAnswer(threadId, reason);
      else await forumsClientApi.acceptAnswer(threadId, reply.id, reason);
    },
    onSuccess: () => {
      toast.success(reply.isAccepted ? "Answer is no longer accepted" : "Answer accepted");
      router.refresh();
    },
    onError: (err) => toast.error(forumErrorMessage(err, "Could not update the accepted answer")),
  });
  const deleteMutation = useMutation({
    mutationFn: () => forumsClientApi.deleteReply(threadId, reply.id),
    onSuccess: () => {
      toast.success("Reply deleted");
      router.refresh();
    },
    onError: (err) => toast.error(forumErrorMessage(err, "Could not delete reply")),
  });

  if (reply.removed) {
    return (
      <li className="border border-border bg-surface-subtle rounded-md p-3 text-sm text-muted-foreground">
        ⊘ A moderator removed this reply for breaking the community guidelines.
      </li>
    );
  }

  return (
    <li className={cn("border bg-surface rounded-md p-3", reply.isAccepted ? "border-success" : "border-border")} aria-label={reply.isAccepted ? "Accepted answer" : undefined}>
      {reply.isAccepted && <Badge variant="success">✓ Accepted answer</Badge>}
      <p className="mt-1 whitespace-pre-wrap text-sm">{reply.content}</p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <p className="text-xs text-muted-foreground">
          {reply.author.firstName} {reply.author.lastName} · <ReputationLine reputation={reply.author.reputation} />
        </p>
        <ReplyLikeButton replyId={reply.id} initialCount={reply._count.likes} disabled={isOwner || !signedIn} />
        {canAccept && (
          <Button variant="glass" size="sm" disabled={acceptMutation.isPending} onClick={() => (isModerator && !isOwner ? setDialog("accept") : acceptMutation.mutate(undefined))}>
            {reply.isAccepted ? "Remove accepted mark" : "Accept this answer"}
          </Button>
        )}
        {signedIn && !isOwner && (
          <Button variant="glass" size="sm" onClick={() => setDialog("report")}>
            Report
          </Button>
        )}
        {isOwner && (
          <Button variant="glass" size="sm" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
            Delete
          </Button>
        )}
        {isModerator && !isOwner && (
          <Button variant="glass" size="sm" onClick={() => setDialog("remove")}>
            Remove
          </Button>
        )}
      </div>
      <ReportDialog open={dialog === "report"} onClose={() => setDialog(null)} what="reply" onSubmit={(dto) => forumsClientApi.reportReply(reply.id, dto)} />
      <ReasonDialog
        open={dialog === "remove"}
        onClose={() => setDialog(null)}
        title="Remove this reply"
        description="The author is told this reason and loses the reputation the reply earned."
        confirmLabel="Remove"
        destructive
        onConfirm={async (reason) => {
          await forumsClientApi.deleteReply(threadId, reply.id, reason);
          toast.success("Reply removed. The author was told why.");
          router.refresh();
        }}
      />
      <ReasonDialog
        open={dialog === "accept"}
        onClose={() => setDialog(null)}
        title={reply.isAccepted ? "Remove the accepted mark" : "Accept this answer for the asker"}
        description="You are not the asker, so this moderator action is audited with your reason."
        confirmLabel="Confirm"
        onConfirm={async (reason) => {
          await acceptMutation.mutateAsync(reason);
        }}
      />
    </li>
  );
}

export function ReplySection({
  threadId,
  threadAuthorId,
  replies,
  isLocked,
}: {
  threadId: string;
  threadAuthorId: string;
  replies: ForumReply[];
  isLocked: boolean;
}) {
  const id = useId();
  const [content, setContent] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const qc = useQueryClient();
  const auth = useAuth();
  const { enabled: postingOn } = useFeatureFlag("forums.posting");
  const isSuperAdmin = auth?.roles.includes("super_admin") ?? false;
  const isModerator = isSuperAdmin || (auth?.permissions.includes("forums:moderate") ?? false);
  const guidelines = useQuery({ queryKey: GUIDELINES_STATUS_KEY, queryFn: forumsClientApi.guidelinesStatus, staleTime: 60_000, enabled: !!auth });
  const mustAccept = guidelines.data ? guidelines.data.mustAccept : false;

  const mutation = useMutation({
    mutationFn: async () => {
      if (mustAccept) {
        await forumsClientApi.acceptGuidelines();
        qc.invalidateQueries({ queryKey: GUIDELINES_STATUS_KEY });
      }
      return forumsClientApi.addReply(threadId, content.trim());
    },
    onSuccess: () => {
      setContent("");
      setError(null);
      router.refresh();
    },
    onError: (err) => setError(forumErrorMessage(err, "Could not post your reply")),
  });

  const visible = replies.filter((r) => !r.removed).length;
  const canAcceptAny = !!auth && (auth.id === threadAuthorId || isModerator);

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Answers and replies ({visible})</h2>

      {isLocked ? (
        <p className="text-sm text-muted-foreground">🔒 This thread is locked.</p>
      ) : !postingOn ? (
        <p role="status" className="text-sm text-muted-foreground">
          Forum posting is switched off for now. You can still read every answer.
        </p>
      ) : (
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (!content.trim()) {
              setError("Write your reply first.");
              return;
            }
            if (mustAccept && !agreed) {
              setError("Accept the community guidelines to post.");
              return;
            }
            setError(null);
            mutation.mutate();
          }}
          className="border border-border bg-surface flex flex-col gap-2 rounded-lg p-3"
        >
          <label htmlFor={`${id}-reply`} className="text-sm font-medium">
            Your answer
          </label>
          <textarea
            id={`${id}-reply`}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            className="rounded-md border border-input bg-background px-3 py-2"
          />
          {mustAccept && (
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1" />
              <span>
                I have read and accept the{" "}
                <Link href="/forums/guidelines" target="_blank" rel="noopener" className="underline">
                  community guidelines
                </Link>
                .
              </span>
            </label>
          )}
          <p className="text-xs text-muted-foreground">
            Never post passwords, keys or customer data.{" "}
            <Link href="/forums/guidelines" className="underline">
              Community guidelines
            </Link>
          </p>
          {error && (
            <p id={`${id}-error`} role="alert" className="text-sm text-danger">
              ⚠ {error}
            </p>
          )}
          <button type="submit" disabled={mutation.isPending} className={cn(buttonVariants({ variant: "gradient" }), "w-fit")}>
            {mutation.isPending ? "Posting…" : "Post answer"}
          </button>
        </form>
      )}

      <ul className="flex flex-col gap-3">
        {replies.map((reply) => (
          <ReplyItem
            key={reply.id}
            threadId={threadId}
            reply={reply}
            isOwner={reply.author.id === auth?.id}
            canAccept={canAcceptAny && !reply.removed}
            isModerator={isModerator}
            signedIn={!!auth}
          />
        ))}
      </ul>
    </div>
  );
}
