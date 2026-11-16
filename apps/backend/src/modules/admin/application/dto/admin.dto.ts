import { createZodDto } from "nestjs-zod";
import {
  AssignRolesSchema,
  CleanDataSchema,
  BulkCleanDataSchema,
  AdminUserListQuerySchema,
  AdminDateRangeQuerySchema,
  AdminActivityListQuerySchema,
  UpdateSiteSettingsSchema,
  ReasonBodySchema,
  DeleteUserSchema,
} from "@packetpulse/types";

export class AssignRolesDto extends createZodDto(AssignRolesSchema) {}
export class CleanDataDto extends createZodDto(CleanDataSchema) {}
export class BulkCleanDataDto extends createZodDto(BulkCleanDataSchema) {}
export class AdminUserListQueryDto extends createZodDto(AdminUserListQuerySchema) {}
export class AdminDateRangeQueryDto extends createZodDto(AdminDateRangeQuerySchema) {}
export class AdminActivityListQueryDto extends createZodDto(AdminActivityListQuerySchema) {}
export class UpdateSiteSettingsDto extends createZodDto(UpdateSiteSettingsSchema) {}
export class ReasonBodyDto extends createZodDto(ReasonBodySchema) {}
export class DeleteUserDto extends createZodDto(DeleteUserSchema) {}
