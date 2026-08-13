import Link from "next/link";
import type { RecordingSummary } from "../api/recordings.api";

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function RecordingCard({ recording }: { recording: RecordingSummary }) {
  return (
    <Link
      href={`/recordings/${recording.id}`}
      className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 text-card-foreground transition hover:border-primary"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{recording.title}</h2>
        {recording.premium && (
          <span className="rounded bg-accent px-2 py-0.5 text-xs text-accent-foreground">Premium</span>
        )}
      </div>
      <p className="line-clamp-2 text-sm text-muted-foreground">{recording.description}</p>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>
          {recording.instructor.firstName} {recording.instructor.lastName}
        </span>
        <span>·</span>
        <span>{formatDuration(recording.durationSeconds)}</span>
        <span>·</span>
        <span>{recording.views} views</span>
        <span>·</span>
        <span>{recording._count.participants} participants</span>
      </div>
    </Link>
  );
}
