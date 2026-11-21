-- CreateEnum
CREATE TYPE "ConsentPurpose" AS ENUM ('terms', 'privacy', 'resume_sharing', 'recruitment_sharing');

-- CreateEnum
CREATE TYPE "ConsentAction" AS ENUM ('granted', 'withdrawn');

-- CreateEnum
CREATE TYPE "ConsentSource" AS ENUM ('registration', 'consent_centre', 'recapture');

-- CreateEnum
CREATE TYPE "ProfileVisibility" AS ENUM ('private', 'members');

-- AlterEnum
ALTER TYPE "AdminActivityAction" ADD VALUE 'consent_policy_published';

-- CreateTable
CREATE TABLE "consent_policies" (
    "id" TEXT NOT NULL,
    "purpose" "ConsentPurpose" NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "effective_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consent_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent_records" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "purpose" "ConsentPurpose" NOT NULL,
    "action" "ConsentAction" NOT NULL,
    "policy_version" INTEGER NOT NULL,
    "source" "ConsentSource" NOT NULL,
    "ip_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consent_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_privacy" (
    "user_id" TEXT NOT NULL,
    "bio" "ProfileVisibility" NOT NULL DEFAULT 'private',
    "professional_experience" "ProfileVisibility" NOT NULL DEFAULT 'private',
    "social_links" "ProfileVisibility" NOT NULL DEFAULT 'private',
    "certifications" "ProfileVisibility" NOT NULL DEFAULT 'private',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profile_privacy_pkey" PRIMARY KEY ("user_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "consent_policies_purpose_version_key" ON "consent_policies"("purpose", "version");

-- CreateIndex
CREATE INDEX "consent_records_user_id_purpose_created_at_idx" ON "consent_records"("user_id", "purpose", "created_at");

-- AddForeignKey
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_purpose_policy_version_fkey" FOREIGN KEY ("purpose", "policy_version") REFERENCES "consent_policies"("purpose", "version") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_privacy" ADD CONSTRAINT "profile_privacy_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Version 1 of each policy, so registration and the consent centre work on a fresh database.
-- Text here is the plain-language summary shown beside the tick; the full documents live on
-- /terms and /privacy. A super admin publishes later versions through the admin API.
INSERT INTO "consent_policies" ("id", "purpose", "version", "title", "summary") VALUES
  (gen_random_uuid()::text, 'terms', 1, 'Terms of Service', 'You agree to use PacketPulse honestly, keep your sign-in private, and follow the community rules.'),
  (gen_random_uuid()::text, 'privacy', 1, 'Privacy Policy', 'PacketPulse stores your name, email and the content you choose to publish, uses them to run your account, and does not sell them.'),
  (gen_random_uuid()::text, 'resume_sharing', 1, 'Share my resume with PacketPulse reviewers', 'The PacketPulse screening team may read the resume you upload. You can withdraw this at any time.'),
  (gen_random_uuid()::text, 'recruitment_sharing', 1, 'Share my profile with hiring companies', 'PacketPulse may forward your profile to a company after a person on the team confirms it. You can withdraw this at any time.')
ON CONFLICT ("purpose", "version") DO NOTHING;

-- Consent history is append-only: a row is never changed. DELETE stays allowed because rows go
-- with the account (ON DELETE CASCADE) until the erasure workflow (TASK-046) defines retention.
CREATE OR REPLACE FUNCTION consent_records_no_update() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'consent_records is append-only: UPDATE is not allowed'
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER consent_records_no_update
  BEFORE UPDATE ON "consent_records"
  FOR EACH ROW EXECUTE FUNCTION consent_records_no_update();

-- Policy versions are immutable too: publish a new version instead of editing one.
CREATE OR REPLACE FUNCTION consent_policies_no_update() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'consent_policies is append-only: publish a new version instead'
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER consent_policies_no_update
  BEFORE UPDATE ON "consent_policies"
  FOR EACH ROW EXECUTE FUNCTION consent_policies_no_update();

-- Only a super admin publishes policy versions (DEC-015, PRD-044): a permission no role holds,
-- so only the super_admin bypass passes. prisma/seed.ts upserts the same row.
INSERT INTO "permissions" ("id", "key")
SELECT gen_random_uuid()::text, 'policies:manage' WHERE NOT EXISTS (SELECT 1 FROM "permissions" WHERE "key" = 'policies:manage');
