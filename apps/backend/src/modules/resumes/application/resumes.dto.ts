import { createZodDto } from "nestjs-zod";
import { CreateResumeUploadSchema, DecideSuggestionSchema } from "@packetpulse/types";

export class CreateResumeUploadBodyDto extends createZodDto(CreateResumeUploadSchema) {}
export class DecideSuggestionBodyDto extends createZodDto(DecideSuggestionSchema) {}
