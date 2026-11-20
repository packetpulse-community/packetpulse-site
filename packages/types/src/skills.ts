import { z } from "zod";
import { RequiredReasonSchema } from "./admin";

// TASK-027 skill taxonomy (PRD-011, DEC-014). Values the docs leave open are the constants below.

export const SKILL_LEVELS = ["major", "minor", "micro"] as const;
export const SkillLevelSchema = z.enum(SKILL_LEVELS);
export type SkillLevel = z.infer<typeof SkillLevelSchema>;

export const SKILL_STATUSES = ["active", "retired"] as const;
export const SkillStatusSchema = z.enum(SKILL_STATUSES);

export const SKILL_VISIBILITIES = ["public", "members", "private"] as const;
export const SkillVisibilitySchema = z.enum(SKILL_VISIBILITIES);
export type SkillVisibility = z.infer<typeof SkillVisibilitySchema>;

export const SKILL_SUGGESTION_STATUSES = ["pending", "merged", "added", "rejected"] as const;
export const SkillSuggestionStatusSchema = z.enum(SKILL_SUGGESTION_STATUSES);
export type SkillSuggestionStatus = z.infer<typeof SkillSuggestionStatusSchema>;

/** Most skills one member may claim (owner decision D1, default 25). */
export const MAX_MEMBER_SKILLS = 25;
/** Visibility given to a newly selected skill (owner decision D2, default "members"). */
export const DEFAULT_SKILL_VISIBILITY: SkillVisibility = "members";
/** Distinct members who must suggest a clear match before it merges by itself (PRD-011). */
export const DEFAULT_AUTO_MERGE_THRESHOLD = 10;
/** Members may open this many new suggestions per rolling day. */
export const MAX_NEW_SUGGESTIONS_PER_DAY = 5;

/** The label every member skill carries until evidence exists (PRD-012). */
export const SELF_DECLARED_LABEL = "self_declared" as const;

const SkillNameSchema = z.string().trim().min(2).max(80);

export const SkillAliasSchema = z.object({ id: z.string().uuid(), alias: z.string() });

export const SkillSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  level: SkillLevelSchema,
  parentId: z.string().uuid().nullable(),
  description: z.string().nullable(),
  position: z.number().int(),
  status: SkillStatusSchema,
  aliases: z.array(SkillAliasSchema),
});
export type Skill = z.infer<typeof SkillSchema>;

export const SkillTaxonomySchema = z.object({
  version: z.number().int(),
  skills: z.array(SkillSchema),
});
export type SkillTaxonomy = z.infer<typeof SkillTaxonomySchema>;

export const CreateSkillSchema = z.object({
  name: SkillNameSchema,
  level: SkillLevelSchema,
  parentId: z.string().uuid().optional(),
  description: z.string().trim().max(300).optional(),
  aliases: z.array(SkillNameSchema).max(10).optional(),
});
export type CreateSkillDto = z.infer<typeof CreateSkillSchema>;

export const UpdateSkillSchema = z.object({
  name: SkillNameSchema.optional(),
  parentId: z.string().uuid().optional(),
  description: z.string().trim().max(300).nullable().optional(),
  position: z.number().int().min(0).max(10000).optional(),
});
export type UpdateSkillDto = z.infer<typeof UpdateSkillSchema>;

/** Retiring hides a skill from pickers; it needs a reason (min 10 chars) for the audit log. */
export const RetireSkillSchema = z.object({ reason: RequiredReasonSchema });
export type RetireSkillDto = z.infer<typeof RetireSkillSchema>;

export const AddSkillAliasSchema = z.object({ alias: SkillNameSchema });
export type AddSkillAliasDto = z.infer<typeof AddSkillAliasSchema>;

export const SuggestSkillSchema = z.object({ name: SkillNameSchema });
export type SuggestSkillDto = z.infer<typeof SuggestSkillSchema>;

export const SkillSuggestionSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  status: SkillSuggestionStatusSchema,
  sightings: z.number().int(),
  matchSkillId: z.string().uuid().nullable(),
  resolvedSkillId: z.string().uuid().nullable(),
  rejectReason: z.string().nullable(),
  createdAt: z.string(),
});
export type SkillSuggestion = z.infer<typeof SkillSuggestionSchema>;

export const SkillSuggestionListQuerySchema = z.object({
  status: SkillSuggestionStatusSchema.optional(),
});

export const AddSuggestionAsSkillSchema = z.object({
  level: SkillLevelSchema,
  parentId: z.string().uuid().optional(),
  name: SkillNameSchema.optional(),
});
export type AddSuggestionAsSkillDto = z.infer<typeof AddSuggestionAsSkillSchema>;

export const MergeSuggestionSchema = z.object({ skillId: z.string().uuid() });
export type MergeSuggestionDto = z.infer<typeof MergeSuggestionSchema>;

export const RejectSuggestionSchema = z.object({ reason: RequiredReasonSchema });
export type RejectSuggestionDto = z.infer<typeof RejectSuggestionSchema>;

export const MemberSkillInputSchema = z.object({
  skillId: z.string().uuid(),
  visibility: SkillVisibilitySchema.default(DEFAULT_SKILL_VISIBILITY),
});

/** Replaces the member's whole selection. Duplicates are rejected, the count is capped. */
export const SetMemberSkillsSchema = z
  .object({ skills: z.array(MemberSkillInputSchema).max(MAX_MEMBER_SKILLS) })
  .superRefine((value, ctx) => {
    const seen = new Set<string>();
    value.skills.forEach((s, i) => {
      if (seen.has(s.skillId)) ctx.addIssue({ code: "custom", path: ["skills", i, "skillId"], message: "Duplicate skill" });
      seen.add(s.skillId);
    });
  });
export type SetMemberSkillsDto = z.infer<typeof SetMemberSkillsSchema>;

export const MemberSkillSchema = z.object({
  skillId: z.string().uuid(),
  name: z.string(),
  level: SkillLevelSchema,
  parentId: z.string().uuid().nullable(),
  visibility: SkillVisibilitySchema,
  label: z.literal(SELF_DECLARED_LABEL),
});
export type MemberSkill = z.infer<typeof MemberSkillSchema>;
