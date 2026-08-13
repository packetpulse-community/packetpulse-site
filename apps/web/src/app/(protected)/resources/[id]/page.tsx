import { cookies } from "next/headers";
import { resourcesServerApi } from "@/features/resources/api/resources.api";
import { ResourceLikeButton } from "@/features/resources/components/LikeButton";

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
          <span key={t.tag} className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
            {t.tag}
          </span>
        ))}
      </div>

      {(resource.fileUrl || resource.externalLink) && (
        <a
          href={resource.fileUrl ?? resource.externalLink ?? "#"}
          target="_blank"
          rel="noreferrer"
          className="w-fit rounded-md bg-primary px-4 py-2 text-primary-foreground"
        >
          {resource.downloadable ? "Download" : "View resource"}
        </a>
      )}
    </article>
  );
}
