"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AUDIT_REASON_MIN_LENGTH, type AdminFeatureFlag } from "@packetpulse/types";
import { featureFlagsApi } from "@/features/feature-flags/api/feature-flags.api";
import { FEATURE_FLAGS_QUERY_KEY } from "@/features/feature-flags/hooks/useFeatureFlags";
import { FeatureSwitch } from "@/features/feature-flags/components/FeatureSwitch";
import { ApiError } from "@/shared/api/http-client";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Button } from "@/shared/ui/primitives/Button";
import { Card } from "@/shared/ui/primitives/Card";
import { Dialog } from "@/shared/ui/primitives/Dialog";
import { EmptyState } from "@/shared/ui/primitives/EmptyState";
import { ErrorState } from "@/shared/ui/primitives/ErrorState";
import { Skeleton, SkeletonScreen } from "@/shared/ui/primitives/Skeleton";

const ADMIN_KEY = ["admin", "feature-flags"] as const;

function message(err: unknown, fallback: string) {
  return err instanceof ApiError ? ((err.body as { message?: string })?.message ?? fallback) : fallback;
}

function formatWhen(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleString();
}

// SCR: Feature switches (TASK-047). Lists every switch with what turning it off does; a change
// always asks for a reason (kept in the audit log) before it is saved.
export function FeatureFlagsAdmin() {
  const [pending, setPending] = useState<{ flag: AdminFeatureFlag; next: boolean } | null>(null);
  const { data, isPending, isError, refetch } = useQuery({ queryKey: ADMIN_KEY, queryFn: featureFlagsApi.adminList });

  if (isPending) {
    return (
      <SkeletonScreen label="Loading feature switches" className="flex flex-col gap-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </SkeletonScreen>
    );
  }
  if (isError) {
    return (
      <ErrorState
        title="We could not load the feature switches."
        description="Check your connection and try again. Nothing was changed."
        retry={{ label: "Try again", onClick: () => void refetch() }}
      />
    );
  }
  if (data.length === 0) {
    return (
      <EmptyState
        title="No feature switches are defined"
        description="Switches are added by the development team. When one exists it appears here."
        action={{ label: "Reload", onClick: () => void refetch() }}
      />
    );
  }

  return (
    <>
      <ul className="flex flex-col gap-3" aria-label="Feature switches">
        {data.map((flag) => (
          <li key={flag.key}>
            <FlagRow flag={flag} onToggle={(next) => setPending({ flag, next })} />
          </li>
        ))}
      </ul>
      {pending && <ReasonDialog flag={pending.flag} next={pending.next} onClose={() => setPending(null)} />}
    </>
  );
}

function FlagRow({ flag, onToggle }: { flag: AdminFeatureFlag; onToggle: (next: boolean) => void }) {
  const titleId = `ff-title-${flag.key}`;
  const descId = `ff-desc-${flag.key}`;
  const when = formatWhen(flag.updatedAt);
  return (
    <Card variant="glass" className="flex flex-wrap items-start gap-4 p-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id={titleId} className="font-mono text-sm font-semibold">
            {flag.key}
          </h2>
          <Badge variant={flag.enabled ? "success" : "outline"} size="sm">
            {flag.enabled ? "On" : "Off"}
          </Badge>
          {flag.overridden && (
            <Badge variant="secondary" size="sm">
              Changed from default
            </Badge>
          )}
          {flag.public && (
            <Badge variant="outline" size="sm">
              Visible to the web app
            </Badge>
          )}
        </div>
        <p id={descId} className="mt-1 text-sm text-muted-foreground">
          {flag.description}
        </p>
        {when && <p className="mt-1 text-xs text-muted-foreground">Last changed {when}</p>}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm" aria-hidden="true">
          {flag.enabled ? "On" : "Off"}
        </span>
        <FeatureSwitch labelledBy={titleId} describedBy={descId} checked={flag.enabled} onChange={onToggle} />
      </div>
    </Card>
  );
}

function ReasonDialog({ flag, next, onClose }: { flag: AdminFeatureFlag; next: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const reasonOk = reason.trim().length >= AUDIT_REASON_MIN_LENGTH;

  const save = useMutation({
    mutationFn: () => featureFlagsApi.adminUpdate(flag.key, { enabled: next, reason: reason.trim() }),
    onSuccess: () => {
      toast.success(`${flag.key} is now ${next ? "on" : "off"}`);
      void queryClient.invalidateQueries({ queryKey: ADMIN_KEY });
      void queryClient.invalidateQueries({ queryKey: FEATURE_FLAGS_QUERY_KEY });
      onClose();
    },
    onError: (err) => setError(message(err, "That did not work. Nothing was changed.")),
  });

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Turn ${flag.key} ${next ? "on" : "off"}?`}
      destructive={!next}
      description={next ? "The feature opens again for everyone who is allowed to use it." : "Members will see that the feature is switched off. Existing content stays."}
      className="max-w-md"
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError("");
          save.mutate();
        }}
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="ff-reason" className="text-sm font-medium">
            Reason (at least {AUDIT_REASON_MIN_LENGTH} characters, kept in the audit log)
          </label>
          <textarea
            id="ff-reason"
            rows={3}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant={next ? "gradient" : "destructive"} disabled={!reasonOk || save.isPending}>
            {save.isPending ? "Saving…" : next ? "Turn on" : "Turn off"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
