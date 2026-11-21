"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError } from "@/shared/api/http-client";
import { ErrorState } from "@/shared/ui/primitives/ErrorState";
import { Skeleton, SkeletonScreen } from "@/shared/ui/primitives/Skeleton";
import { dataRightsApi, dataRightsKeys } from "../api/data-rights.api";
import { exportIsWorking } from "../lib/data-rights-logic";
import { ConfirmErasureDialog } from "./ConfirmErasureDialog";
import { ErasurePanel } from "./ErasurePanel";
import { ExportPanel } from "./ExportPanel";
import { RetentionPanel } from "./RetentionPanel";

function apiMessage(err: unknown, fallback: string) {
  return err instanceof ApiError ? ((err.body as { message?: string } | null)?.message ?? fallback) : fallback;
}

// SCR-038: data rights. Runs for a deactivated account too (the backend lets these routes through).
export function DataRightsCentre() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [erasureError, setErasureError] = useState<string | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"request" | "download" | "discard" | null>(null);

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: dataRightsKeys.overview,
    queryFn: dataRightsApi.overview,
    // While the job is running, look again every few seconds.
    refetchInterval: (q) => (exportIsWorking(q.state.data?.export ?? null) ? 3000 : false),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: dataRightsKeys.overview });

  const request = useMutation({
    mutationFn: dataRightsApi.requestExport,
    onMutate: () => {
      setBusy("request");
      setExportError(null);
    },
    onSuccess: async () => {
      await refresh();
      toast.success("We are preparing your data. We will email you when it is ready.");
    },
    onError: (err) => setExportError(apiMessage(err, "We could not start your export. Please try again.")),
    onSettled: () => setBusy(null),
  });

  const download = useMutation({
    mutationFn: dataRightsApi.exportLink,
    onMutate: () => {
      setBusy("download");
      setExportError(null);
    },
    // A fresh link each time; it works for a few minutes only.
    onSuccess: (link) => window.location.assign(link.url),
    onError: async (err) => {
      setExportError(apiMessage(err, "We could not get your download link. Please try again."));
      await refresh(); // an export that just expired should show as expired
    },
    onSettled: () => setBusy(null),
  });

  const discard = useMutation({
    mutationFn: dataRightsApi.discardExport,
    onMutate: () => {
      setBusy("discard");
      setExportError(null);
    },
    onSuccess: async () => {
      await refresh();
      toast.success("The export was discarded.");
    },
    onError: (err) => setExportError(apiMessage(err, "We could not discard the export. Please try again.")),
    onSettled: () => setBusy(null),
  });

  const schedule = useMutation({
    mutationFn: (password: string) => dataRightsApi.requestErasure({ password }),
    onMutate: () => setDialogError(null),
    onSuccess: async () => {
      setDialogOpen(false);
      await refresh();
      toast.success("Deletion scheduled. You can cancel until the date shown.");
    },
    // The server's own message ("Password is incorrect") is shown under the password field.
    onError: (err) => setDialogError(apiMessage(err, "We could not schedule the deletion. Please try again.")),
  });

  const cancel = useMutation({
    mutationFn: dataRightsApi.cancelErasure,
    onMutate: () => setErasureError(null),
    onSuccess: async () => {
      await refresh();
      toast.success("Deletion cancelled. Your account is active again.");
    },
    onError: (err) => setErasureError(apiMessage(err, "We could not cancel the deletion. Please try again.")),
  });

  if (isPending) {
    return (
      <SkeletonScreen label="Loading your data rights" className="flex flex-col gap-4">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </SkeletonScreen>
    );
  }
  if (isError) {
    return (
      <ErrorState
        title="We could not load your data rights."
        description="Check your connection and try again. Nothing was changed."
        retry={{ label: "Try again", onClick: () => void refetch() }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <ExportPanel
        request={data.export}
        enabled={data.exportEnabled}
        availableDays={data.exportAvailableDays}
        busy={busy}
        error={exportError}
        onRequest={() => request.mutate()}
        onDownload={() => download.mutate()}
        onDiscard={() => discard.mutate()}
      />
      <section aria-labelledby="other-rights" className="rounded-grove-card border border-border bg-surface p-4 text-sm">
        <h2 id="other-rights" className="font-semibold">Correct or withdraw</h2>
        <ul className="mt-2 flex flex-col gap-1">
          <li>
            Correct your details in your <Link href="/profile" className="underline">profile</Link>.
          </li>
          <li>
            Review and withdraw consents in <Link href="/settings/privacy" className="underline">privacy and consent</Link>.
          </li>
        </ul>
      </section>
      <ErasurePanel
        request={data.erasure}
        graceDays={data.graceDays}
        busy={cancel.isPending}
        error={erasureError}
        onStart={() => {
          setDialogError(null);
          setDialogOpen(true);
        }}
        onCancel={() => cancel.mutate()}
      />
      <RetentionPanel />
      <ConfirmErasureDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        graceDays={data.graceDays}
        pending={schedule.isPending}
        error={dialogError}
        onConfirm={(password) => schedule.mutate(password)}
      />
    </div>
  );
}
