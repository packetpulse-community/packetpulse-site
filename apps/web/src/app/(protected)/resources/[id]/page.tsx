import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowLeft, Download, Eye, User } from "lucide-react";
import { resourcesServerApi } from "@/features/resources/api/resources.api";
import { ResourceLikeButton } from "@/features/resources/components/LikeButton";
import { DownloadButton } from "@/features/resources/components/DownloadButton";
import { ResourcePreviewModal } from "@/features/resources/components/ResourcePreviewModal";
import { RelatedResources } from "@/features/resources/components/RelatedResources";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Card } from "@/shared/ui/primitives/Card";
import { CalloutBox } from "@/shared/components/CalloutBox";
import { buttonVariants } from "@/shared/ui/primitives/Button";
import { cn } from "@/shared/utils/cn";

export default async function ResourceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieHeader = (await cookies()).toString();
  const resource = await resourcesServerApi.getById(id, cookieHeader);
  const related = await resourcesServerApi.related(resource.category, resource.id, cookieHeader);

  return (
    <article className="flex flex-col gap-6">
      <Link href="/resources" className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="h-4 w-4" />
        Back to Resources
      </Link>

      <Card variant="glass" className="flex flex-col gap-6 p-6">
        <div className="flex flex-wrap gap-2">
          <Badge variant="glass">{resource.resourceType}</Badge>
          <Badge variant="glass">{resource.category}</Badge>
          {resource.premium && <Badge variant="glass">Premium</Badge>}
        </div>

        <h1 className="text-3xl font-semibold">{resource.title}</h1>

        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <User className="h-4 w-4" />
            {resource.user.firstName} {resource.user.lastName}
          </span>
          <span className="flex items-center gap-1">
            <Eye className="h-4 w-4" />
            {resource.views} views
          </span>
          <span className="flex items-center gap-1">
            <Download className="h-4 w-4" />
            {resource.downloads} downloads
          </span>
          <ResourceLikeButton resourceId={resource.id} initialCount={resource._count.likes} />
        </div>

        {resource.thumbnailUrl && (
          <img src={resource.thumbnailUrl} alt={resource.title} className="max-h-96 w-full rounded-lg object-cover" />
        )}

        <p className="whitespace-pre-wrap text-base leading-relaxed">{resource.description}</p>

        <div className="flex flex-wrap gap-2">
          {resource.tags.map((t) => (
            <Badge key={t.tag} variant="glass">
              #{t.tag}
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

        <CalloutBox
          title="Deepen Your Knowledge"
          description={`Want to explore more about ${resource.category}? Check out related articles or join the discussion.`}
        >
          <Link href={`/blogs?category=${resource.category}`} className={cn(buttonVariants({ variant: "gradient" }))}>
            Read Related Articles
          </Link>
          <Link href="/forums" className={cn(buttonVariants({ variant: "glass" }))}>
            Join Discussion
          </Link>
        </CalloutBox>
      </Card>

      <RelatedResources resources={related} />
    </article>
  );
}
