import { cookies } from "next/headers";
import { recordingsServerApi } from "@/features/recordings/api/recordings.api";
import { RecordingActions } from "@/features/recordings/components/RecordingActions";

export default async function RecordingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieHeader = (await cookies()).toString();
  const recording = await recordingsServerApi.getById(id, cookieHeader);

  return (
    <article className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">{recording.title}</h1>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>
            {recording.instructor.firstName} {recording.instructor.lastName}
          </span>
          <span>·</span>
          <span>{recording.category}</span>
          <span>·</span>
          <span>{recording.views} views</span>
          <RecordingActions recordingId={recording.id} initialLikes={recording._count.likes} />
        </div>
      </header>

      <video controls className="w-full rounded-lg border border-border" poster={recording.thumbnailUrl ?? undefined}>
        <source src={recording.recordingUrl} />
        Your browser does not support embedded video.{" "}
        <a href={recording.recordingUrl} target="_blank" rel="noreferrer">
          Open the recording directly
        </a>
        .
      </video>

      <p className="whitespace-pre-wrap text-base leading-relaxed">{recording.description}</p>
    </article>
  );
}
