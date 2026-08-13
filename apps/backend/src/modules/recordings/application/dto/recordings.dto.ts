import { createZodDto } from "nestjs-zod";
import { CreateRecordingSchema, UpdateRecordingSchema, RecordingListQuerySchema } from "@packetpulse/types";

export class CreateRecordingDto extends createZodDto(CreateRecordingSchema) {}
export class UpdateRecordingDto extends createZodDto(UpdateRecordingSchema) {}
export class RecordingListQueryDto extends createZodDto(RecordingListQuerySchema) {}
