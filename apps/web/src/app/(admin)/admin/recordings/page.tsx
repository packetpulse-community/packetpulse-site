import { cookies } from "next/headers";
import { adminServerApi } from "@/features/admin/api/admin.api";
import { RecordingApproveButton } from "@/features/admin/components/RecordingApproveButton";

export default async function AdminRecordingsPage() {
  const cookieHeader = (await cookies()).toString();
  const pending = await adminServerApi.pendingRecordings(cookieHeader);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Pending Recordings</h1>
      <div className="flex flex-col gap-2">
        {pending.map((recording) => (
          <div key={recording.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
            <div>
              <p className="font-medium">{recording.title}</p>
              <p className="text-sm text-muted-foreground">
                {recording.instructor.firstName} {recording.instructor.lastName}
              </p>
            </div>
            <RecordingApproveButton recordingId={recording.id} />
          </div>
        ))}
        {pending.length === 0 && <p className="text-muted-foreground">Nothing pending.</p>}
      </div>
    </div>
  );
}
