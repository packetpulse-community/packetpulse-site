-- TASK-026: community Q&A modes, accepted answer, reports, guidelines and reputation ledger (PRD-024..028, PRD-054, DB-013, DB-030).
-- CreateEnum
CREATE TYPE "ForumThreadMode" AS ENUM ('learning', 'production', 'expert');

-- CreateEnum
CREATE TYPE "ForumReportReason" AS ENUM ('spam', 'off_topic', 'harassment', 'sensitive_data', 'assessment_answers', 'other');

-- CreateEnum
CREATE TYPE "ForumReportStatus" AS ENUM ('open', 'dismissed', 'removed');

-- CreateEnum
CREATE TYPE "ForumReputationKind" AS ENUM ('answer_accepted', 'helpful_vote', 'post_removed', 'reversal');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'forum_answer_accepted';
ALTER TYPE "NotificationType" ADD VALUE 'forum_post_removed';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AdminActivityAction" ADD VALUE 'forum_report_dismissed';
ALTER TYPE "AdminActivityAction" ADD VALUE 'forum_report_removed';
ALTER TYPE "AdminActivityAction" ADD VALUE 'forum_answer_accepted';
ALTER TYPE "AdminActivityAction" ADD VALUE 'forum_guidelines_published';

-- AlterTable
ALTER TABLE "forum_threads" ADD COLUMN     "accepted_at" TIMESTAMP(3),
ADD COLUMN     "accepted_reply_id" TEXT,
ADD COLUMN     "mode" "ForumThreadMode" NOT NULL DEFAULT 'learning',
ADD COLUMN     "removed_at" TIMESTAMP(3),
ADD COLUMN     "removed_reason" TEXT;

-- AlterTable
ALTER TABLE "forum_replies" ADD COLUMN     "removed_at" TIMESTAMP(3),
ADD COLUMN     "removed_reason" TEXT;

-- CreateTable
CREATE TABLE "forum_reports" (
    "id" TEXT NOT NULL,
    "reporter_id" TEXT NOT NULL,
    "thread_id" TEXT,
    "reply_id" TEXT,
    "reason" "ForumReportReason" NOT NULL,
    "details" TEXT,
    "urgent" BOOLEAN NOT NULL DEFAULT false,
    "status" "ForumReportStatus" NOT NULL DEFAULT 'open',
    "resolved_by_id" TEXT,
    "resolved_at" TIMESTAMP(3),
    "resolution" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "forum_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forum_guideline_versions" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "forum_guideline_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forum_guideline_acceptances" (
    "user_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "accepted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "forum_guideline_acceptances_pkey" PRIMARY KEY ("user_id","version")
);

-- CreateTable
CREATE TABLE "forum_reputation_events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "kind" "ForumReputationKind" NOT NULL,
    "points" INTEGER NOT NULL,
    "content_type" TEXT NOT NULL,
    "content_id" TEXT NOT NULL,
    "actor_id" TEXT,
    "reverses_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "forum_reputation_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "forum_reports_status_urgent_created_at_idx" ON "forum_reports"("status", "urgent", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "forum_reports_reporter_id_thread_id_key" ON "forum_reports"("reporter_id", "thread_id");

-- CreateIndex
CREATE UNIQUE INDEX "forum_reports_reporter_id_reply_id_key" ON "forum_reports"("reporter_id", "reply_id");

-- CreateIndex
CREATE UNIQUE INDEX "forum_guideline_versions_version_key" ON "forum_guideline_versions"("version");

-- CreateIndex
CREATE UNIQUE INDEX "forum_reputation_events_reverses_id_key" ON "forum_reputation_events"("reverses_id");

-- CreateIndex
CREATE INDEX "forum_reputation_events_user_id_created_at_idx" ON "forum_reputation_events"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "forum_reputation_events_content_type_content_id_idx" ON "forum_reputation_events"("content_type", "content_id");

-- CreateIndex
CREATE UNIQUE INDEX "forum_threads_accepted_reply_id_key" ON "forum_threads"("accepted_reply_id");

-- AddForeignKey
ALTER TABLE "forum_threads" ADD CONSTRAINT "forum_threads_accepted_reply_id_fkey" FOREIGN KEY ("accepted_reply_id") REFERENCES "forum_replies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_reports" ADD CONSTRAINT "forum_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_reports" ADD CONSTRAINT "forum_reports_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "forum_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_reports" ADD CONSTRAINT "forum_reports_reply_id_fkey" FOREIGN KEY ("reply_id") REFERENCES "forum_replies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_reports" ADD CONSTRAINT "forum_reports_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_guideline_versions" ADD CONSTRAINT "forum_guideline_versions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_guideline_acceptances" ADD CONSTRAINT "forum_guideline_acceptances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_reputation_events" ADD CONSTRAINT "forum_reputation_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_reputation_events" ADD CONSTRAINT "forum_reputation_events_reverses_id_fkey" FOREIGN KEY ("reverses_id") REFERENCES "forum_reputation_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- The reputation ledger is append-only (PRD-026): a total is always SUM(points), so rows are never
-- edited or removed. Deleting a user cascades their rows, which is the one allowed delete.
CREATE OR REPLACE FUNCTION forum_reputation_events_append_only() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' AND pg_trigger_depth() > 1 THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'forum_reputation_events is append-only: % is not allowed', TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER forum_reputation_events_no_update_delete
  BEFORE UPDATE OR DELETE ON "forum_reputation_events"
  FOR EACH ROW EXECUTE FUNCTION forum_reputation_events_append_only();

-- Version 1 of the guidelines: the rules of Document 1, section 10.4 (an admin edits them from the site).
INSERT INTO "forum_guideline_versions" ("id", "version", "body", "created_at") VALUES (
  '00000000-0000-4000-8000-000000000026', 1,
  E'Be respectful. Disagree with the idea, not the person.\nNever post passwords, keys, customer data or confidential network configurations.\nNo job spam, solicitation or advertising in questions.\nDo not copy assessment answers.\nCredit your sources.\nNo harassment, doxxing or discrimination.\n\nWhen a post breaks these rules a moderator removes it and tells you the reason. Further steps are a warning, a posting limit for 7 days, a posting limit for 30 days, and account suspension (two admins must agree). Reports are acknowledged within 24 hours; urgent ones (exposed credentials, harassment) within 4 hours. You can appeal; a different admin reviews it within 5 working days.',
  CURRENT_TIMESTAMP);
