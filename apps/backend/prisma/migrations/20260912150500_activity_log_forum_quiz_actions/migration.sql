-- Appends forum-moderation and quiz-CRUD action types to AdminActivityAction so
-- those admin actions can be logged (previously only blog/resource/recording
-- moderation wrote activity-log rows, undercounting the Activity Distribution
-- chart). Kept as its own migration, separate from the shared_categories one -
-- Postgres requires ALTER TYPE ... ADD VALUE to run outside a transaction that
-- also does other DDL.
ALTER TYPE "AdminActivityAction" ADD VALUE 'forum_thread_locked';
ALTER TYPE "AdminActivityAction" ADD VALUE 'forum_thread_unlocked';
ALTER TYPE "AdminActivityAction" ADD VALUE 'forum_thread_pinned';
ALTER TYPE "AdminActivityAction" ADD VALUE 'forum_thread_unpinned';
ALTER TYPE "AdminActivityAction" ADD VALUE 'forum_thread_deleted';
ALTER TYPE "AdminActivityAction" ADD VALUE 'quiz_created';
ALTER TYPE "AdminActivityAction" ADD VALUE 'quiz_updated';
ALTER TYPE "AdminActivityAction" ADD VALUE 'quiz_deleted';
