import { RecordingCard } from "./RecordingCard";
import type { RecordingSummary } from "../api/recordings.api";

export function RelatedRecordings({ recordings }: { recordings: RecordingSummary[] }) {
  if (recordings.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Related Recordings</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {recordings.map((recording) => (
          <RecordingCard key={recording.id} recording={recording} />
        ))}
      </div>
    </div>
  );
}
