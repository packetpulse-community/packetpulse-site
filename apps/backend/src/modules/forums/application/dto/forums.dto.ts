import { createZodDto } from "nestjs-zod";
import { CreateForumThreadSchema, CreateForumReplySchema, ForumThreadListQuerySchema } from "@packetpulse/types";

export class CreateForumThreadDto extends createZodDto(CreateForumThreadSchema) {}
export class CreateForumReplyDto extends createZodDto(CreateForumReplySchema) {}
export class ForumThreadListQueryDto extends createZodDto(ForumThreadListQuerySchema) {}
