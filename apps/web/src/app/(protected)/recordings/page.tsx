import { cookies } from "next/headers";
import { recordingsServerApi } from "@/features/recordings/api/recordings.api";
import { RecordingCard } from "@/features/recordings/components/RecordingCard";

export default async function RecordingsPage() {
  const cookieHeader = (await cookies()).toString();
  const { data: recordings } = await recordingsServerApi.list(cookieHeader);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Recordings</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        {recordings.map((recording) => (
          <RecordingCard key={recording.id} recording={recording} />
        ))}
        {recordings.length === 0 && <p className="text-muted-foreground">No recordings yet.</p>}
      </div>
    </div>
  );
}
