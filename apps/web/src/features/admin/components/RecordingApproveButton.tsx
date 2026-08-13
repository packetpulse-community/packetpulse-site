"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { adminClientApi } from "../api/admin.api";

export function RecordingApproveButton({ recordingId }: { recordingId: string }) {
  const [done, setDone] = useState(false);
  const router = useRouter();

  const mutation = useMutation({
    mutationFn: () => adminClientApi.approveRecording(recordingId),
    onSuccess: () => {
      setDone(true);
      router.refresh();
    },
  });

  if (done) return <span className="text-sm text-muted-foreground">Approved</span>;

  return (
    <button
      onClick={() => mutation.mutate()}
      disabled={mutation.isPending}
      className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
    >
      {mutation.isPending ? "Approving…" : "Approve"}
    </button>
  );
}
