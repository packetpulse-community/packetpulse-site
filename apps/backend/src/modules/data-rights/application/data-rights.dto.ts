import { createZodDto } from "nestjs-zod";
import { AdminDataRequestListQuerySchema, RequestErasureSchema } from "@packetpulse/types";

export class RequestErasureDto extends createZodDto(RequestErasureSchema) {}
export class AdminDataRequestListQueryDto extends createZodDto(AdminDataRequestListQuerySchema) {}
