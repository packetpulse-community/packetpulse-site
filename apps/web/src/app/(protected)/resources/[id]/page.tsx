import { cookies } from "next/headers";
import { resourcesServerApi } from "@/features/resources/api/resources.api";
import { ResourceLikeButton } from "@/features/resources/components/LikeButton";
import { DownloadButton } from "@/features/resources/components/DownloadButton";
import { ResourcePreviewModal } from "@/features/resources/components/ResourcePreviewModal";
import { Badge } from "@/shared/ui/primitives/Badge";

export default async function ResourceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieHeader = (await cookies()).toString();
  const resource = await resourcesServerApi.getById(id, cookieHeader);

  return (
    <article className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">{resource.title}</h1>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>
            {resource.user.firstName} {resource.user.lastName}
          </span>
          <span>·</span>
          <span>{resource.resourceType}</span>
          <span>·</span>
          <span>{resource.category}</span>
          <span>·</span>
          <span>{resource.views} views</span>
          <ResourceLikeButton resourceId={resource.id} initialCount={resource._count.likes} />
        </div>
      </header>

      <p className="whitespace-pre-wrap text-base leading-relaxed">{resource.description}</p>

      <div className="flex flex-wrap gap-2">
        {resource.tags.map((t) => (
          <Badge key={t.tag} variant="glass">
            {t.tag}
          </Badge>
        ))}
      </div>

      <div className="flex items-center gap-3">
        {(resource.fileUrl || resource.externalLink) && (
          <DownloadButton
            resourceId={resource.id}
            href={resource.fileUrl ?? resource.externalLink ?? "#"}
            label={resource.downloadable ? "Download" : "View resource"}
          />
        )}
        <ResourcePreviewModal title={resource.title} resourceType={resource.resourceType} fileUrl={resource.fileUrl} />
      </div>
    </article>
  );
}
