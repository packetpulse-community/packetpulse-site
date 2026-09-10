import { z } from "zod";
import { PaginationQuerySchema } from "./common";

export const CreateForumThreadSchema = z.object({
  categoryId: z.string().uuid(),
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(10000),
});
export type CreateForumThreadDto = z.infer<typeof CreateForumThreadSchema>;

export const CreateForumReplySchema = z.object({
  content: z.string().min(1).max(10000),
  parentReplyId: z.string().uuid().optional(),
});
export type CreateForumReplyDto = z.infer<typeof CreateForumReplySchema>;

export const ForumThreadListQuerySchema = PaginationQuerySchema.extend({
  categoryId: z.string().uuid().optional(),
  search: z.string().optional(),
});
export type ForumThreadListQuery = z.infer<typeof ForumThreadListQuerySchema>;

export const UpdateForumThreadSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).max(10000).optional(),
});
export type UpdateForumThreadDto = z.infer<typeof UpdateForumThreadSchema>;
