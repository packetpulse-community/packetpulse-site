import { z } from "zod";
import { PaginationQuerySchema } from "./common";

export const AssignRolesSchema = z.object({
  roleNames: z.array(z.string().min(1)).min(1),
});
export type AssignRolesDto = z.infer<typeof AssignRolesSchema>;

// Real implementation replacing the old app's commented-out clean-data stub —
// dataType values map to actual deletable content types that exist now.
export const CleanDataSchema = z.object({
  dataType: z.enum(["quiz_attempts", "certificates", "forum_posts", "all"]),
});
export type CleanDataDto = z.infer<typeof CleanDataSchema>;

export const BulkCleanDataSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1).max(200),
  dataType: z.enum(["quiz_attempts", "certificates", "forum_posts", "all"]),
});
export type BulkCleanDataDto = z.infer<typeof BulkCleanDataSchema>;

export const AdminUserListQuerySchema = PaginationQuerySchema.extend({
  search: z.string().optional(),
  approved: z.coerce.boolean().optional(),
});
export type AdminUserListQuery = z.infer<typeof AdminUserListQuerySchema>;
