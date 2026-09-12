-- Replaces BlogCategory/ResourceCategory/RecordingCategory enums and the
-- ForumCategory table with a single shared `categories` table used by
-- blog_posts, resources, recordings, quizzes, and forum_threads. Hand-written
-- (not `prisma migrate dev` diff output) because the enum -> table conversion
-- needs data backfill interleaved between DDL steps, which Prisma's diff tool
-- can't generate on its own.

-- 1. New shared table.
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- 2. Canonical seed rows (fixed ids so this insert is idempotent/re-runnable,
-- and so the enum/forum-category backfill below has stable targets).
INSERT INTO "categories" ("id", "name", "slug", "position", "updated_at") VALUES
    ('00000000-0000-0000-0000-000000000001', 'General Discussion', 'general', 0, CURRENT_TIMESTAMP),
    ('00000000-0000-0000-0000-000000000002', 'CCNA', 'ccna', 1, CURRENT_TIMESTAMP),
    ('00000000-0000-0000-0000-000000000003', 'CCNP', 'ccnp', 2, CURRENT_TIMESTAMP),
    ('00000000-0000-0000-0000-000000000004', 'Network Automation', 'network-automation', 3, CURRENT_TIMESTAMP),
    ('00000000-0000-0000-0000-000000000005', 'Security', 'security', 4, CURRENT_TIMESTAMP),
    ('00000000-0000-0000-0000-000000000006', 'SDN', 'sdn', 5, CURRENT_TIMESTAMP),
    ('00000000-0000-0000-0000-000000000007', 'IPv6', 'ipv6', 6, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

-- 3. Add nullable category_id columns alongside the old enum columns.
ALTER TABLE "blog_posts" ADD COLUMN "category_id" TEXT;
ALTER TABLE "resources" ADD COLUMN "category_id" TEXT;
ALTER TABLE "recordings" ADD COLUMN "category_id" TEXT;
ALTER TABLE "quizzes" ADD COLUMN "category_id" TEXT;

-- 4. Backfill by matching the old enum value's slug. `network_automation`
-- (enum, underscore) is mapped explicitly to `network-automation` (hyphen) --
-- every other value's slug matches the enum value string exactly.
UPDATE "blog_posts" b SET "category_id" = c."id" FROM "categories" c
    WHERE c."slug" = (CASE WHEN b."category"::text = 'network_automation' THEN 'network-automation' ELSE b."category"::text END);
UPDATE "resources" r SET "category_id" = c."id" FROM "categories" c
    WHERE c."slug" = (CASE WHEN r."category"::text = 'network_automation' THEN 'network-automation' ELSE r."category"::text END);
UPDATE "recordings" rec SET "category_id" = c."id" FROM "categories" c
    WHERE c."slug" = (CASE WHEN rec."category"::text = 'network_automation' THEN 'network-automation' ELSE rec."category"::text END);
UPDATE "quizzes" q SET "category_id" = c."id" FROM "categories" c
    WHERE c."slug" = (CASE WHEN q."category"::text = 'network_automation' THEN 'network-automation' ELSE q."category"::text END);

-- 5. Guard: fail loudly instead of silently shipping NULL/orphaned rows.
DO $$
DECLARE cnt integer;
BEGIN
    SELECT count(*) INTO cnt FROM "blog_posts" WHERE "category_id" IS NULL;
    IF cnt > 0 THEN RAISE EXCEPTION 'blog_posts: % rows failed category backfill', cnt; END IF;
    SELECT count(*) INTO cnt FROM "resources" WHERE "category_id" IS NULL;
    IF cnt > 0 THEN RAISE EXCEPTION 'resources: % rows failed category backfill', cnt; END IF;
    SELECT count(*) INTO cnt FROM "recordings" WHERE "category_id" IS NULL;
    IF cnt > 0 THEN RAISE EXCEPTION 'recordings: % rows failed category backfill', cnt; END IF;
    SELECT count(*) INTO cnt FROM "quizzes" WHERE "category_id" IS NULL;
    IF cnt > 0 THEN RAISE EXCEPTION 'quizzes: % rows failed category backfill', cnt; END IF;
END $$;

-- 6. Lock down + link.
ALTER TABLE "blog_posts" ALTER COLUMN "category_id" SET NOT NULL;
ALTER TABLE "resources" ALTER COLUMN "category_id" SET NOT NULL;
ALTER TABLE "recordings" ALTER COLUMN "category_id" SET NOT NULL;
ALTER TABLE "quizzes" ALTER COLUMN "category_id" SET NOT NULL;

ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "resources" ADD CONSTRAINT "resources_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "recordings" ADD CONSTRAINT "recordings_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "blog_posts_category_id_idx" ON "blog_posts"("category_id");
CREATE INDEX "resources_category_id_idx" ON "resources"("category_id");
CREATE INDEX "recordings_category_id_idx" ON "recordings"("category_id");
CREATE INDEX "quizzes_is_published_category_id_idx" ON "quizzes"("is_published", "category_id");

-- 7. Drop the old enum columns/types (dependent indexes on these columns are
-- dropped automatically by Postgres along with the column).
ALTER TABLE "blog_posts" DROP COLUMN "category";
ALTER TABLE "resources" DROP COLUMN "category";
ALTER TABLE "recordings" DROP COLUMN "category";
ALTER TABLE "quizzes" DROP COLUMN "category";

DROP TYPE "BlogCategory";
DROP TYPE "ResourceCategory";
DROP TYPE "RecordingCategory";

-- 8. Repoint forum_threads from forum_categories to the new shared table
-- (matched by slug). forum_threads has 0 rows in both the local and Supabase
-- databases today, so this UPDATE is a no-op safety net, not a real risk.
ALTER TABLE "forum_threads" DROP CONSTRAINT "forum_threads_category_id_fkey";

UPDATE "forum_threads" ft SET "category_id" = c."id"
    FROM "forum_categories" fc JOIN "categories" c ON c."slug" = fc."slug"
    WHERE ft."category_id" = fc."id";

ALTER TABLE "forum_threads" ADD CONSTRAINT "forum_threads_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

DROP TABLE "forum_categories";
