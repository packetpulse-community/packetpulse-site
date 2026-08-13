import { createZodDto } from "nestjs-zod";
import { CreateResourceSchema, UpdateResourceSchema, ResourceListQuerySchema } from "@packetpulse/types";

export class CreateResourceDto extends createZodDto(CreateResourceSchema) {}
export class UpdateResourceDto extends createZodDto(UpdateResourceSchema) {}
export class ResourceListQueryDto extends createZodDto(ResourceListQuerySchema) {}
