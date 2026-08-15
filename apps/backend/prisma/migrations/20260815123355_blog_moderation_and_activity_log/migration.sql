-- CreateEnum
CREATE TYPE "AdminActivityAction" AS ENUM ('user_approved', 'user_unapproved', 'user_roles_changed', 'user_deleted', 'resource_approved', 'recording_approved', 'blog_approved');

-- AlterTable
ALTER TABLE "blog_posts" ADD COLUMN     "is_approved" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "admin_activity_logs" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT,
    "action" "AdminActivityAction" NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "admin_activity_logs_created_at_idx" ON "admin_activity_logs"("created_at");

-- CreateIndex
CREATE INDEX "admin_activity_logs_action_idx" ON "admin_activity_logs"("action");

-- CreateIndex
CREATE INDEX "blog_posts_is_approved_idx" ON "blog_posts"("is_approved");

-- AddForeignKey
ALTER TABLE "admin_activity_logs" ADD CONSTRAINT "admin_activity_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
