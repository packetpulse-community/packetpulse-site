import { createZodDto } from "nestjs-zod";
import { CreateUploadUrlSchema } from "@packetpulse/types";

export class CreateUploadUrlDto extends createZodDto(CreateUploadUrlSchema) {}
