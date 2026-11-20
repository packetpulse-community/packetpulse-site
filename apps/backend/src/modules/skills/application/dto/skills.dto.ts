import { createZodDto } from "nestjs-zod";
import {
  AddSkillAliasSchema,
  AddSuggestionAsSkillSchema,
  CreateSkillSchema,
  MergeSuggestionSchema,
  RejectSuggestionSchema,
  RetireSkillSchema,
  SetMemberSkillsSchema,
  SkillSuggestionListQuerySchema,
  SuggestSkillSchema,
  UpdateSkillSchema,
} from "@packetpulse/types";

export class CreateSkillDto extends createZodDto(CreateSkillSchema) {}
export class UpdateSkillDto extends createZodDto(UpdateSkillSchema) {}
export class RetireSkillDto extends createZodDto(RetireSkillSchema) {}
export class AddSkillAliasDto extends createZodDto(AddSkillAliasSchema) {}
export class SuggestSkillDto extends createZodDto(SuggestSkillSchema) {}
export class SkillSuggestionListQueryDto extends createZodDto(SkillSuggestionListQuerySchema) {}
export class AddSuggestionAsSkillDto extends createZodDto(AddSuggestionAsSkillSchema) {}
export class MergeSuggestionDto extends createZodDto(MergeSuggestionSchema) {}
export class RejectSuggestionDto extends createZodDto(RejectSuggestionSchema) {}
export class SetMemberSkillsDto extends createZodDto(SetMemberSkillsSchema) {}
