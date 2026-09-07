import Link from "next/link";
import { Eye, Users2, PlayCircle } from "lucide-react";
import { cardVariants } from "@/shared/ui/primitives/Card";
import { Badge } from "@/shared/ui/primitives/Badge";
import { cn } from "@/shared/utils/cn";
import type { RecordingSummary } from "../api/recordings.api";

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function RecordingCard({ recording }: { recording: RecordingSummary }) {
  return (
    <Link href={`/recordings/${recording.id}`} className={cn(cardVariants({ variant: "glass" }), "flex flex-col overflow-hidden")}>
      <div className="relative h-40 w-full overflow-hidden bg-slate-900">
        {recording.thumbnailUrl ? (
          <img src={recording.thumbnailUrl} alt={recording.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-indigo-900/60 to-purple-900/60">
            <PlayCircle className="h-10 w-10 text-white/60" />
          </div>
        )}
        <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-xs text-white">
          {formatDuration(recording.durationSeconds)}
        </span>
      </div>
      <div className="flex flex-col gap-2 p-4">
        <div className="flex items-center justify-between">
          <h2 className="line-clamp-2 text-lg font-semibold">{recording.title}</h2>
          {recording.premium && <Badge variant="glass">Premium</Badge>}
        </div>
        <p className="line-clamp-2 text-sm text-muted-foreground">{recording.description}</p>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {recording.instructor.firstName} {recording.instructor.lastName}
          </span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Eye className="h-3 w-3" />
              {recording.views}
            </span>
            <span className="flex items-center gap-1">
              <Users2 className="h-3 w-3" />
              {recording._count.participants}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
