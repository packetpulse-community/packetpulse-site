import Link from "next/link";
import { cookies, headers } from "next/headers";
import { ArrowLeft, Calendar, Clock, ThumbsUp } from "lucide-react";
import { blogsServerApi } from "@/features/blogs/api/blogs.api";
import { CommentSection } from "@/features/blogs/components/CommentSection";
import { LikeButton } from "@/features/blogs/components/LikeButton";
import { ReadingProgressBar } from "@/features/blogs/components/ReadingProgressBar";
import { ShareButtons } from "@/features/blogs/components/ShareButtons";
import { RelatedPosts } from "@/features/blogs/components/RelatedPosts";
import { RelatedIllustrations } from "@/features/blogs/components/RelatedIllustrations";
import { AuthorCard } from "@/features/blogs/components/AuthorCard";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Card } from "@/shared/ui/primitives/Card";
import { CalloutBox } from "@/shared/components/CalloutBox";
import { buttonVariants } from "@/shared/ui/primitives/Button";
import { cn } from "@/shared/utils/cn";
import { estimateReadTime } from "@/shared/utils/readTime";

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

      <Link href="/blogs" className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="h-4 w-4" />
        Back to Blogs
      </Link>

      <Card variant="glass" className="flex flex-col gap-6 p-6">
        <div className="flex flex-wrap gap-2">
          <Badge variant="glass">{post.category}</Badge>
          {post.tags.map((t) => (
            <Link key={t.tag} href={`/blogs?tag=${t.tag}`}>
              <Badge variant="glass">#{t.tag}</Badge>
            </Link>
          ))}
        </div>

        <h1 className="text-3xl font-semibold">{post.title}</h1>

        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span>
            {post.author.firstName} {post.author.lastName}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            {new Date(post.postedAt).toLocaleDateString()}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            {estimateReadTime(post.content)} min read
          </span>
          <span className="flex items-center gap-1">
            <ThumbsUp className="h-4 w-4" />
            {post._count.likes}
          </span>
        </div>

        {post.coverImageUrl && (
          <img src={post.coverImageUrl} alt={post.title} className="max-h-96 w-full rounded-lg object-cover" />
        )}

        <div className="flex items-center gap-3">
          <LikeButton postId={post.id} initialCount={post._count.likes} />
          <ShareButtons title={post.title} url={shareUrl} />
        </div>

        <div className="whitespace-pre-wrap text-base leading-relaxed">{post.content}</div>

        <RelatedIllustrations images={post.images} />

        <CalloutBox
          title="Deepen Your Knowledge"
          description={`Want to explore more about ${post.tags[0]?.tag ?? post.category}? Check out our related resources or join the discussion below.`}
        >
          <Link href={`/resources?category=${post.category}`} className={cn(buttonVariants({ variant: "gradient" }))}>
            Explore Related Topics
          </Link>
          <Link href="/forums" className={cn(buttonVariants({ variant: "glass" }))}>
            Join Discussion
          </Link>
        </CalloutBox>

        {post.tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Tags:</span>
            {post.tags.map((t) => (
              <Link key={t.tag} href={`/blogs?tag=${t.tag}`}>
                <Badge variant="glass">#{t.tag}</Badge>
              </Link>
            ))}
          </div>
        )}

        <AuthorCard author={post.author} />

        <CommentSection postId={post.id} initialComments={post.comments} />
      </Card>

      <RelatedPosts posts={related} />
    </article>
  );
}
