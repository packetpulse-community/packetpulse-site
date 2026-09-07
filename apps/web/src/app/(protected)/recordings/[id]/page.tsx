import { cookies } from "next/headers";
import { recordingsServerApi } from "@/features/recordings/api/recordings.api";
import { RecordingActions } from "@/features/recordings/components/RecordingActions";
import { VideoPlayer } from "@/features/recordings/components/VideoPlayer";
import { RelatedRecordings } from "@/features/recordings/components/RelatedRecordings";

export default async function RecordingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieHeader = (await cookies()).toString();
  const recording = await recordingsServerApi.getById(id, cookieHeader);
  const related = await recordingsServerApi.related(recording.category, recording.id, cookieHeader);

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

      <VideoPlayer src={recording.recordingUrl} poster={recording.thumbnailUrl ?? undefined} />

      <p className="whitespace-pre-wrap text-base leading-relaxed">{recording.description}</p>

      <RelatedRecordings recordings={related} />
    </article>
  );
}
