-- TASK-024: resume upload and parsing (PRD-007, PRD-046, DB-005, API-007) - resumes (one current per member via active_slot), parsed suggestions, and the education / experience entries a member accepts. Additive only. Rollback: DROP the four tables and three enums.
-- CreateEnum
CREATE TYPE "ResumeStatus" AS ENUM ('awaiting_upload', 'parsing', 'ready', 'failed', 'rejected');

-- CreateEnum
CREATE TYPE "ResumeSuggestionKind" AS ENUM ('skill', 'education', 'experience');

-- CreateEnum
CREATE TYPE "ResumeSuggestionStatus" AS ENUM ('pending', 'accepted', 'rejected');

-- CreateTable
CREATE TABLE "resumes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "file_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "ResumeStatus" NOT NULL DEFAULT 'awaiting_upload',
    "active_slot" TEXT,
    "failure_code" TEXT,
    "parse_run" INTEGER NOT NULL DEFAULT 0,
    "parse_started_at" TIMESTAMP(3),
    "parsed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resumes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resume_suggestions" (
    "id" TEXT NOT NULL,
    "resume_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "kind" "ResumeSuggestionKind" NOT NULL,
    "data" JSONB NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "status" "ResumeSuggestionStatus" NOT NULL DEFAULT 'pending',
    "decided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resume_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_education" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "institution" TEXT,
    "qualification" TEXT,
    "start_year" INTEGER,
    "end_year" INTEGER,
    "source_suggestion_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_education_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_experience" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT,
    "company" TEXT,
    "start_date" TEXT,
    "end_date" TEXT,
    "current" BOOLEAN NOT NULL DEFAULT false,
    "source_suggestion_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_experience_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "resumes_file_id_key" ON "resumes"("file_id");

-- CreateIndex
CREATE INDEX "resumes_status_updated_at_idx" ON "resumes"("status", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "resumes_user_id_version_key" ON "resumes"("user_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "resumes_user_id_active_slot_key" ON "resumes"("user_id", "active_slot");

-- CreateIndex
CREATE INDEX "resume_suggestions_user_id_idx" ON "resume_suggestions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "resume_suggestions_resume_id_fingerprint_key" ON "resume_suggestions"("resume_id", "fingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "member_education_source_suggestion_id_key" ON "member_education"("source_suggestion_id");

-- CreateIndex
CREATE INDEX "member_education_user_id_idx" ON "member_education"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "member_experience_source_suggestion_id_key" ON "member_experience"("source_suggestion_id");

-- CreateIndex
CREATE INDEX "member_experience_user_id_idx" ON "member_experience"("user_id");

-- AddForeignKey
ALTER TABLE "resumes" ADD CONSTRAINT "resumes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resumes" ADD CONSTRAINT "resumes_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "stored_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resume_suggestions" ADD CONSTRAINT "resume_suggestions_resume_id_fkey" FOREIGN KEY ("resume_id") REFERENCES "resumes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resume_suggestions" ADD CONSTRAINT "resume_suggestions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_education" ADD CONSTRAINT "member_education_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_experience" ADD CONSTRAINT "member_experience_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

