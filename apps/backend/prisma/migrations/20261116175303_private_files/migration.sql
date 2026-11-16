-- CreateEnum
CREATE TYPE "StoredFileKind" AS ENUM ('resume', 'certificate', 'evidence');

-- CreateEnum
CREATE TYPE "StoredFileStatus" AS ENUM ('pending', 'available', 'rejected', 'deleted');

-- CreateEnum
CREATE TYPE "FileAccessAction" AS ENUM ('upload_url', 'complete', 'open', 'delete', 'denied');

-- CreateTable
CREATE TABLE "stored_files" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "kind" "StoredFileKind" NOT NULL,
    "original_name" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "bucket" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "status" "StoredFileStatus" NOT NULL DEFAULT 'pending',
    "scan_result" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stored_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_access_logs" (
    "id" TEXT NOT NULL,
    "file_id" TEXT NOT NULL,
    "actor_id" TEXT,
    "action" "FileAccessAction" NOT NULL,
    "ip" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "file_access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stored_files_owner_id_idx" ON "stored_files"("owner_id");

-- CreateIndex
CREATE INDEX "stored_files_status_created_at_idx" ON "stored_files"("status", "created_at");

-- CreateIndex
CREATE INDEX "file_access_logs_file_id_created_at_idx" ON "file_access_logs"("file_id", "created_at");

-- CreateIndex
CREATE INDEX "file_access_logs_actor_id_idx" ON "file_access_logs"("actor_id");

-- AddForeignKey
ALTER TABLE "stored_files" ADD CONSTRAINT "stored_files_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- SEC-03: the access log is append-only; the database refuses to edit or delete rows.
CREATE OR REPLACE FUNCTION file_access_logs_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'file_access_logs is append-only: % is not allowed', TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER file_access_logs_no_update_delete
  BEFORE UPDATE OR DELETE ON "file_access_logs"
  FOR EACH ROW EXECUTE FUNCTION file_access_logs_append_only();
