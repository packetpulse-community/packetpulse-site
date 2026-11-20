-- TASK-027: skill taxonomy (Major > Minor > Micro), aliases, suggestion queue, member skills.
CREATE TYPE "SkillLevel" AS ENUM ('major', 'minor', 'micro');

CREATE TYPE "SkillStatus" AS ENUM ('active', 'retired');

CREATE TYPE "SkillSuggestionStatus" AS ENUM ('pending', 'merged', 'added', 'rejected');

CREATE TYPE "SkillVisibility" AS ENUM ('public', 'members', 'private');



ALTER TYPE "AdminActivityAction" ADD VALUE 'skill_created';
ALTER TYPE "AdminActivityAction" ADD VALUE 'skill_updated';
ALTER TYPE "AdminActivityAction" ADD VALUE 'skill_retired';
ALTER TYPE "AdminActivityAction" ADD VALUE 'skill_restored';
ALTER TYPE "AdminActivityAction" ADD VALUE 'skill_alias_added';
ALTER TYPE "AdminActivityAction" ADD VALUE 'skill_alias_removed';
ALTER TYPE "AdminActivityAction" ADD VALUE 'skill_suggestion_added';
ALTER TYPE "AdminActivityAction" ADD VALUE 'skill_suggestion_merged';
ALTER TYPE "AdminActivityAction" ADD VALUE 'skill_suggestion_rejected';
ALTER TYPE "AdminActivityAction" ADD VALUE 'skill_suggestion_auto_merged';

CREATE TABLE "skill_taxonomy_state" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "version" INTEGER NOT NULL DEFAULT 1,
    "auto_merge_threshold" INTEGER NOT NULL DEFAULT 10,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skill_taxonomy_state_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "skills" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_key" TEXT NOT NULL,
    "match_key" TEXT NOT NULL,
    "level" "SkillLevel" NOT NULL,
    "parent_id" TEXT,
    "description" TEXT,
    "status" "SkillStatus" NOT NULL DEFAULT 'active',
    "position" INTEGER NOT NULL DEFAULT 0,
    "retired_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skills_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "skill_aliases" (
    "id" TEXT NOT NULL,
    "skill_id" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "alias_key" TEXT NOT NULL,
    "match_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skill_aliases_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "skill_suggestions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_key" TEXT NOT NULL,
    "match_key" TEXT NOT NULL,
    "status" "SkillSuggestionStatus" NOT NULL DEFAULT 'pending',
    "sightings" INTEGER NOT NULL DEFAULT 1,
    "match_skill_id" TEXT,
    "suggested_by_id" TEXT,
    "resolved_skill_id" TEXT,
    "resolved_at" TIMESTAMP(3),
    "reject_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skill_suggestions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "skill_suggestion_sightings" (
    "suggestion_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skill_suggestion_sightings_pkey" PRIMARY KEY ("suggestion_id","user_id")
);

CREATE TABLE "member_skills" (
    "user_id" TEXT NOT NULL,
    "skill_id" TEXT NOT NULL,
    "visibility" "SkillVisibility" NOT NULL DEFAULT 'members',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_skills_pkey" PRIMARY KEY ("user_id","skill_id")
);

CREATE UNIQUE INDEX "skills_name_key_key" ON "skills"("name_key");

CREATE INDEX "skills_parent_id_idx" ON "skills"("parent_id");

CREATE INDEX "skills_level_status_idx" ON "skills"("level", "status");

CREATE INDEX "skills_match_key_idx" ON "skills"("match_key");

CREATE UNIQUE INDEX "skill_aliases_alias_key_key" ON "skill_aliases"("alias_key");

CREATE INDEX "skill_aliases_skill_id_idx" ON "skill_aliases"("skill_id");

CREATE INDEX "skill_aliases_match_key_idx" ON "skill_aliases"("match_key");

CREATE UNIQUE INDEX "skill_suggestions_name_key_key" ON "skill_suggestions"("name_key");

CREATE INDEX "skill_suggestions_status_sightings_idx" ON "skill_suggestions"("status", "sightings");

CREATE INDEX "member_skills_skill_id_idx" ON "member_skills"("skill_id");

ALTER TABLE "skills" ADD CONSTRAINT "skills_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "skills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "skill_aliases" ADD CONSTRAINT "skill_aliases_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "skill_suggestions" ADD CONSTRAINT "skill_suggestions_suggested_by_id_fkey" FOREIGN KEY ("suggested_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "skill_suggestions" ADD CONSTRAINT "skill_suggestions_resolved_skill_id_fkey" FOREIGN KEY ("resolved_skill_id") REFERENCES "skills"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "skill_suggestion_sightings" ADD CONSTRAINT "skill_suggestion_sightings_suggestion_id_fkey" FOREIGN KEY ("suggestion_id") REFERENCES "skill_suggestions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "skill_suggestion_sightings" ADD CONSTRAINT "skill_suggestion_sightings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "member_skills" ADD CONSTRAINT "member_skills_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "member_skills" ADD CONSTRAINT "member_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- A major skill has no parent; minor and micro skills must have one. (Which level the parent
-- must be is checked by the service, because a CHECK cannot look at another row.)
ALTER TABLE "skills" ADD CONSTRAINT "skills_level_parent_check"
  CHECK (("level" = 'major' AND "parent_id" IS NULL) OR ("level" <> 'major' AND "parent_id" IS NOT NULL));

-- The taxonomy starts at version 1 with the default auto-merge threshold (PRD-011: 10).
INSERT INTO "skill_taxonomy_state" ("id", "version", "auto_merge_threshold", "updated_at")
VALUES ('default', 1, 10, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;

-- Permission for managing the taxonomy, granted to the admin role (super_admin bypasses checks).
-- prisma/seed.ts upserts the same rows, so running both is harmless.
INSERT INTO "permissions" ("id", "key")
SELECT gen_random_uuid()::text, 'skills:manage' WHERE NOT EXISTS (SELECT 1 FROM "permissions" WHERE "key" = 'skills:manage');
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id" FROM "roles" r, "permissions" p
WHERE r."name" = 'admin' AND p."key" = 'skills:manage'
ON CONFLICT DO NOTHING;
