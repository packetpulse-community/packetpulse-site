import { createZodDto } from "nestjs-zod";
import { AssignRolesSchema, CleanDataSchema, BulkCleanDataSchema, AdminUserListQuerySchema } from "@packetpulse/types";

export class AssignRolesDto extends createZodDto(AssignRolesSchema) {}
export class CleanDataDto extends createZodDto(CleanDataSchema) {}
export class BulkCleanDataDto extends createZodDto(BulkCleanDataSchema) {}
export class AdminUserListQueryDto extends createZodDto(AdminUserListQuerySchema) {}
