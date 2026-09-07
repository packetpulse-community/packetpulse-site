"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card } from "@/shared/ui/primitives/Card";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Button } from "@/shared/ui/primitives/Button";
import { Dialog } from "@/shared/ui/primitives/Dialog";
import { adminClientApi } from "../api/admin.api";
import { recordingsClientApi, type RecordingSummary } from "@/features/recordings/api/recordings.api";
import { RecordingForm } from "./RecordingForm";

export function AdminRecordingsTable({ recordings }: { recordings: RecordingSummary[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<RecordingSummary | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<RecordingSummary | null>(null);

  const approveMutation = useMutation({
    mutationFn: (r: RecordingSummary) =>
      r.isApproved ? adminClientApi.unapproveRecording(r.id) : adminClientApi.approveRecording(r.id),
    onSuccess: (_, r) => {
      toast.success(r.isApproved ? "Recording unapproved" : "Recording approved");
      router.refresh();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not update approval"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => recordingsClientApi.delete(id),
    onSuccess: () => {
      toast.success("Recording deleted");
      router.refresh();
      setDeleting(null);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not delete recording"),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button variant="gradient" onClick={() => setCreating(true)}>
          Create Recording
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        {recordings.map((recording) => (
          <Card key={recording.id} variant="glass" className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <p className="font-medium">{recording.title}</p>
                <Badge variant={recording.isApproved ? "success" : "warning"}>
                  {recording.isApproved ? "Approved" : "Pending"}
                </Badge>
                {recording.premium && <Badge variant="glass">Premium</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">
                {recording.category} · {recording.instructor.firstName} {recording.instructor.lastName}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="glass" size="sm" onClick={() => approveMutation.mutate(recording)} disabled={approveMutation.isPending}>
                {recording.isApproved ? "Unapprove" : "Approve"}
              </Button>
              <Button variant="glass" size="sm" onClick={() => setEditing(recording)}>
                Edit
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setDeleting(recording)}>
                Delete
              </Button>
            </div>
          </Card>
        ))}
        {recordings.length === 0 && <p className="text-muted-foreground">No recordings found.</p>}
      </div>

      {(editing || creating) && (
        <RecordingForm
          recording={editing ?? undefined}
          open={true}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
        />
      )}

      <Dialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete recording"
        description="This action cannot be undone."
      >
        <p className="text-sm text-muted-foreground">
          Delete <span className="font-medium text-foreground">{deleting?.title}</span>?
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDeleting(null)} disabled={deleteMutation.isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => deleting && deleteMutation.mutate(deleting.id)}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? "Deleting…" : "Delete"}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
