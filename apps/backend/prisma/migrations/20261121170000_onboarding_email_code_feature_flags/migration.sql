-- AlterTable
ALTER TABLE "users" ADD COLUMN     "age_confirmed_at" TIMESTAMP(3),
ADD COLUMN     "career_goals" TEXT,
ADD COLUMN     "date_of_birth" DATE,
ADD COLUMN     "onboarding_completed_at" TIMESTAMP(3),
ADD COLUMN     "target_role" TEXT;

-- CreateTable
CREATE TABLE "email_verification_codes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verification_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_flags" (
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "updated_by" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "email_verification_codes_user_id_created_at_idx" ON "email_verification_codes"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "email_verification_codes" ADD CONSTRAINT "email_verification_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Members who already exist are grandfathered: the onboarding flow is for new sign-ups, so
-- nobody who signed up before it existed is sent back through it (TASK-023).
UPDATE "users" SET "onboarding_completed_at" = COALESCE("created_at", NOW()) WHERE "onboarding_completed_at" IS NULL;
