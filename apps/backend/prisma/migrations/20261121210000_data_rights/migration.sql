-- TASK-046: data rights (PRD-045, DB-028, API-009, SCR-038) - export and erasure requests, account deactivation/tombstone columns, data_export file kind, audit actions.
-- CreateEnum
CREATE TYPE "DataRequestKind" AS ENUM ('export', 'erasure');

-- CreateEnum
CREATE TYPE "DataRequestStatus" AS ENUM ('requested', 'preparing', 'ready', 'scheduled', 'completed', 'cancelled', 'expired', 'failed');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AdminActivityAction" ADD VALUE 'data_export_requested';
ALTER TYPE "AdminActivityAction" ADD VALUE 'data_export_ready';
ALTER TYPE "AdminActivityAction" ADD VALUE 'data_export_downloaded';
ALTER TYPE "AdminActivityAction" ADD VALUE 'data_export_discarded';
ALTER TYPE "AdminActivityAction" ADD VALUE 'data_export_expired';
ALTER TYPE "AdminActivityAction" ADD VALUE 'account_deletion_requested';
ALTER TYPE "AdminActivityAction" ADD VALUE 'account_deletion_cancelled';
ALTER TYPE "AdminActivityAction" ADD VALUE 'account_erased';
ALTER TYPE "AdminActivityAction" ADD VALUE 'retention_cleanup_run';

-- AlterEnum
ALTER TYPE "StoredFileKind" ADD VALUE 'data_export';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "deactivated_at" TIMESTAMP(3),
ADD COLUMN     "erased_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "data_requests" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "kind" "DataRequestKind" NOT NULL,
    "status" "DataRequestStatus" NOT NULL,
    "active_slot" TEXT,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scheduled_for" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "ready_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "file_id" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "failure_code" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "data_requests_file_id_key" ON "data_requests"("file_id");

-- CreateIndex
CREATE INDEX "data_requests_status_scheduled_for_idx" ON "data_requests"("status", "scheduled_for");

-- CreateIndex
CREATE INDEX "data_requests_status_expires_at_idx" ON "data_requests"("status", "expires_at");

-- CreateIndex
CREATE INDEX "data_requests_user_id_requested_at_idx" ON "data_requests"("user_id", "requested_at");

-- CreateIndex
CREATE UNIQUE INDEX "data_requests_user_id_kind_active_slot_key" ON "data_requests"("user_id", "kind", "active_slot");

-- AddForeignKey
ALTER TABLE "data_requests" ADD CONSTRAINT "data_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_requests" ADD CONSTRAINT "data_requests_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "stored_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

