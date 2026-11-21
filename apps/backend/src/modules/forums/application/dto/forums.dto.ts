import { createZodDto } from "nestjs-zod";
import {
  CreateForumThreadSchema,
  CreateForumReplySchema,
  ForumThreadListQuerySchema,
  UpdateForumThreadSchema,
  CreateForumReportSchema,
  ForumReasonSchema,
  ForumOptionalReasonSchema,
  ForumReportListQuerySchema,
  PublishForumGuidelinesSchema,
} from "@packetpulse/types";

export class CreateForumThreadDto extends createZodDto(CreateForumThreadSchema) {}
export class CreateForumReplyDto extends createZodDto(CreateForumReplySchema) {}
export class ForumThreadListQueryDto extends createZodDto(ForumThreadListQuerySchema) {}
export class UpdateForumThreadDto extends createZodDto(UpdateForumThreadSchema) {}
export class CreateForumReportDto extends createZodDto(CreateForumReportSchema) {}
export class ForumReasonDto extends createZodDto(ForumReasonSchema) {}
export class ForumOptionalReasonDto extends createZodDto(ForumOptionalReasonSchema) {}
export class ForumReportListQueryDto extends createZodDto(ForumReportListQuerySchema) {}
export class PublishForumGuidelinesDto extends createZodDto(PublishForumGuidelinesSchema) {}
