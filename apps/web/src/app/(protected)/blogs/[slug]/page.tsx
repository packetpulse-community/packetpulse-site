import { cookies, headers } from "next/headers";
import { blogsServerApi } from "@/features/blogs/api/blogs.api";
import { CommentSection } from "@/features/blogs/components/CommentSection";
import { LikeButton } from "@/features/blogs/components/LikeButton";
import { ReadingProgressBar } from "@/features/blogs/components/ReadingProgressBar";
import { ShareButtons } from "@/features/blogs/components/ShareButtons";
import { RelatedPosts } from "@/features/blogs/components/RelatedPosts";

export default async function BlogDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const cookieHeader = (await cookies()).toString();
  const post = await blogsServerApi.getBySlug(slug, cookieHeader);
  const related = await blogsServerApi.related(post.category, post.id, cookieHeader);

  const host = (await headers()).get("host");
  const shareUrl = `${host ? `https://${host}` : ""}/blogs/${post.slug}`;

  return (
    <article className="flex flex-col gap-6">
      <ReadingProgressBar />
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">{post.title}</h1>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span>
            {post.author.firstName} {post.author.lastName}
          </span>
          <span>·</span>
          <span>{post.category}</span>
          <span>·</span>
          <span>{post.viewCount} views</span>
          <LikeButton postId={post.id} initialCount={post._count.likes} />
        </div>
        <ShareButtons title={post.title} url={shareUrl} />
      </header>

      <div className="whitespace-pre-wrap text-base leading-relaxed">{post.content}</div>

      <CommentSection postId={post.id} initialComments={post.comments} />

      <RelatedPosts posts={related} />
    </article>
  );
}
