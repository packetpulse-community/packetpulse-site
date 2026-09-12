import { createZodDto } from "nestjs-zod";
import { CreateCategorySchema, UpdateCategorySchema, ReorderCategoriesSchema } from "@packetpulse/types";

export class CreateCategoryDto extends createZodDto(CreateCategorySchema) {}
export class UpdateCategoryDto extends createZodDto(UpdateCategorySchema) {}
export class ReorderCategoriesDto extends createZodDto(ReorderCategoriesSchema) {}
