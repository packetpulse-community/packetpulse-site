-- CreateEnum
CREATE TYPE "BlogCategory" AS ENUM ('ccna', 'ccnp', 'network_automation', 'security', 'sdn', 'ipv6', 'general');

-- CreateEnum
CREATE TYPE "ResourceType" AS ENUM ('pdf', 'video', 'article', 'tutorial', 'diagram', 'config_template', 'tool', 'external_link');

-- CreateEnum
CREATE TYPE "ResourceCategory" AS ENUM ('ccna', 'ccnp', 'network_automation', 'security', 'sdn', 'ipv6', 'general');

-- CreateEnum
CREATE TYPE "RecordingCategory" AS ENUM ('ccna', 'ccnp', 'network_automation', 'security', 'sdn', 'ipv6', 'general');

-- CreateTable
CREATE TABLE "blog_posts" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "cover_image_url" TEXT,
    "category" "BlogCategory" NOT NULL DEFAULT 'general',
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "posted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blog_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_post_tags" (
    "blog_post_id" TEXT NOT NULL,
    "tag" TEXT NOT NULL,

    CONSTRAINT "blog_post_tags_pkey" PRIMARY KEY ("blog_post_id","tag")
);

-- CreateTable
CREATE TABLE "blog_post_images" (
    "id" TEXT NOT NULL,
    "blog_post_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "blog_post_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_comments" (
    "id" TEXT NOT NULL,
    "blog_post_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blog_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_likes" (
    "blog_post_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blog_likes_pkey" PRIMARY KEY ("blog_post_id","user_id")
);

-- CreateTable
CREATE TABLE "resources" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "resource_type" "ResourceType" NOT NULL,
    "category" "ResourceCategory" NOT NULL,
    "file_url" TEXT,
    "external_link" TEXT,
    "thumbnail_url" TEXT,
    "downloadable" BOOLEAN NOT NULL DEFAULT true,
    "premium" BOOLEAN NOT NULL DEFAULT false,
    "user_id" TEXT NOT NULL,
    "downloads" INTEGER NOT NULL DEFAULT 0,
    "views" INTEGER NOT NULL DEFAULT 0,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "is_approved" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resource_tags" (
    "resource_id" TEXT NOT NULL,
    "tag" TEXT NOT NULL,

    CONSTRAINT "resource_tags_pkey" PRIMARY KEY ("resource_id","tag")
);

-- CreateTable
CREATE TABLE "resource_likes" (
    "resource_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resource_likes_pkey" PRIMARY KEY ("resource_id","user_id")
);

-- CreateTable
CREATE TABLE "recordings" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "recording_url" TEXT NOT NULL,
    "thumbnail_url" TEXT,
    "duration_seconds" INTEGER NOT NULL DEFAULT 0,
    "category" "RecordingCategory" NOT NULL,
    "instructor_id" TEXT NOT NULL,
    "premium" BOOLEAN NOT NULL DEFAULT false,
    "is_featured" BOOLEAN NOT NULL DEFAULT true,
    "is_approved" BOOLEAN NOT NULL DEFAULT true,
    "views" INTEGER NOT NULL DEFAULT 0,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recordings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recording_tags" (
    "recording_id" TEXT NOT NULL,
    "tag" TEXT NOT NULL,

    CONSTRAINT "recording_tags_pkey" PRIMARY KEY ("recording_id","tag")
);

-- CreateTable
CREATE TABLE "recording_participants" (
    "recording_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recording_participants_pkey" PRIMARY KEY ("recording_id","user_id")
);

-- CreateTable
CREATE TABLE "recording_likes" (
    "recording_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recording_likes_pkey" PRIMARY KEY ("recording_id","user_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "blog_posts_slug_key" ON "blog_posts"("slug");

-- CreateIndex
CREATE INDEX "blog_posts_category_idx" ON "blog_posts"("category");

-- CreateIndex
CREATE INDEX "blog_posts_is_published_posted_at_idx" ON "blog_posts"("is_published", "posted_at");

-- CreateIndex
CREATE INDEX "blog_post_tags_tag_idx" ON "blog_post_tags"("tag");

-- CreateIndex
CREATE INDEX "blog_post_images_blog_post_id_idx" ON "blog_post_images"("blog_post_id");

-- CreateIndex
CREATE INDEX "blog_comments_blog_post_id_created_at_idx" ON "blog_comments"("blog_post_id", "created_at");

-- CreateIndex
CREATE INDEX "blog_likes_user_id_idx" ON "blog_likes"("user_id");

-- CreateIndex
CREATE INDEX "resources_category_idx" ON "resources"("category");

-- CreateIndex
CREATE INDEX "resources_resource_type_idx" ON "resources"("resource_type");

-- CreateIndex
CREATE INDEX "resources_is_approved_premium_idx" ON "resources"("is_approved", "premium");

-- CreateIndex
CREATE INDEX "resource_tags_tag_idx" ON "resource_tags"("tag");

-- CreateIndex
CREATE INDEX "resource_likes_user_id_idx" ON "resource_likes"("user_id");

-- CreateIndex
CREATE INDEX "recordings_category_idx" ON "recordings"("category");

-- CreateIndex
CREATE INDEX "recordings_is_approved_premium_idx" ON "recordings"("is_approved", "premium");

-- CreateIndex
CREATE INDEX "recording_tags_tag_idx" ON "recording_tags"("tag");

-- CreateIndex
CREATE INDEX "recording_participants_user_id_idx" ON "recording_participants"("user_id");

-- CreateIndex
CREATE INDEX "recording_likes_user_id_idx" ON "recording_likes"("user_id");

-- AddForeignKey
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_post_tags" ADD CONSTRAINT "blog_post_tags_blog_post_id_fkey" FOREIGN KEY ("blog_post_id") REFERENCES "blog_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_post_images" ADD CONSTRAINT "blog_post_images_blog_post_id_fkey" FOREIGN KEY ("blog_post_id") REFERENCES "blog_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_comments" ADD CONSTRAINT "blog_comments_blog_post_id_fkey" FOREIGN KEY ("blog_post_id") REFERENCES "blog_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_comments" ADD CONSTRAINT "blog_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_likes" ADD CONSTRAINT "blog_likes_blog_post_id_fkey" FOREIGN KEY ("blog_post_id") REFERENCES "blog_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_likes" ADD CONSTRAINT "blog_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resources" ADD CONSTRAINT "resources_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_tags" ADD CONSTRAINT "resource_tags_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_likes" ADD CONSTRAINT "resource_likes_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_likes" ADD CONSTRAINT "resource_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recordings" ADD CONSTRAINT "recordings_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recording_tags" ADD CONSTRAINT "recording_tags_recording_id_fkey" FOREIGN KEY ("recording_id") REFERENCES "recordings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recording_participants" ADD CONSTRAINT "recording_participants_recording_id_fkey" FOREIGN KEY ("recording_id") REFERENCES "recordings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recording_participants" ADD CONSTRAINT "recording_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recording_likes" ADD CONSTRAINT "recording_likes_recording_id_fkey" FOREIGN KEY ("recording_id") REFERENCES "recordings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recording_likes" ADD CONSTRAINT "recording_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
