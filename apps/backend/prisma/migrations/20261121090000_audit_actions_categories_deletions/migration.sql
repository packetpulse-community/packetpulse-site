-- TASK-015: audit actions for category management and for staff deleting other people's content.
-- Enum additions only; the append-only trigger and existing rows are untouched.
ALTER TYPE "AdminActivityAction" ADD VALUE 'category_created';
ALTER TYPE "AdminActivityAction" ADD VALUE 'category_updated';
ALTER TYPE "AdminActivityAction" ADD VALUE 'category_deleted';
ALTER TYPE "AdminActivityAction" ADD VALUE 'categories_reordered';
ALTER TYPE "AdminActivityAction" ADD VALUE 'blog_deleted';
ALTER TYPE "AdminActivityAction" ADD VALUE 'blog_comment_deleted';
ALTER TYPE "AdminActivityAction" ADD VALUE 'resource_deleted';
ALTER TYPE "AdminActivityAction" ADD VALUE 'recording_deleted';
ALTER TYPE "AdminActivityAction" ADD VALUE 'forum_reply_deleted';
