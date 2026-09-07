import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowLeft, Eye, User } from "lucide-react";
import { recordingsServerApi } from "@/features/recordings/api/recordings.api";
import { RecordingActions } from "@/features/recordings/components/RecordingActions";
import { VideoPlayer } from "@/features/recordings/components/VideoPlayer";
import { RelatedRecordings } from "@/features/recordings/components/RelatedRecordings";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Card } from "@/shared/ui/primitives/Card";
import { CalloutBox } from "@/shared/components/CalloutBox";
import { buttonVariants } from "@/shared/ui/primitives/Button";
import { cn } from "@/shared/utils/cn";

export default async function RecordingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieHeader = (await cookies()).toString();
  const recording = await recordingsServerApi.getById(id, cookieHeader);
  const related = await recordingsServerApi.related(recording.category, recording.id, cookieHeader);

  return (
    <article className="flex flex-col gap-6">
      <Link href="/recordings" className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="h-4 w-4" />
        Back to Recordings
      </Link>

      <Card variant="glass" className="flex flex-col gap-6 p-6">
        <div className="flex flex-wrap gap-2">
          <Badge variant="glass">{recording.category}</Badge>
          {recording.premium && <Badge variant="glass">Premium</Badge>}
        </div>

        <h1 className="text-3xl font-semibold">{recording.title}</h1>

        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <User className="h-4 w-4" />
            {recording.instructor.firstName} {recording.instructor.lastName}
          </span>
          <span className="flex items-center gap-1">
            <Eye className="h-4 w-4" />
            {recording.views} views
          </span>
          <RecordingActions recordingId={recording.id} initialLikes={recording._count.likes} />
        </div>

        <VideoPlayer src={recording.recordingUrl} poster={recording.thumbnailUrl ?? undefined} />

        <p className="whitespace-pre-wrap text-base leading-relaxed">{recording.description}</p>

        <div className="flex flex-wrap gap-2">
          {recording.tags.map((t) => (
            <Badge key={t.tag} variant="glass">
              #{t.tag}
            </Badge>
          ))}
        </div>

        <CalloutBox
          title="Deepen Your Knowledge"
          description={`Want to explore more about ${recording.category}? Check out related resources or join the discussion.`}
        >
          <Link href={`/resources?category=${recording.category}`} className={cn(buttonVariants({ variant: "gradient" }))}>
            Explore Related Resources
          </Link>
          <Link href="/forums" className={cn(buttonVariants({ variant: "glass" }))}>
            Join Discussion
          </Link>
        </CalloutBox>
      </Card>

      <RelatedRecordings recordings={related} />
    </article>
  );
}
