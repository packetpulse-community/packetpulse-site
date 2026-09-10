import { createZodDto } from "nestjs-zod";
import { CreateQuizSchema, QuizListQuerySchema, SubmitQuizAttemptSchema, UpdateQuizSchema } from "@packetpulse/types";

export class CreateQuizDto extends createZodDto(CreateQuizSchema) {}
export class QuizListQueryDto extends createZodDto(QuizListQuerySchema) {}
export class SubmitQuizAttemptDto extends createZodDto(SubmitQuizAttemptSchema) {}
export class UpdateQuizDto extends createZodDto(UpdateQuizSchema) {}
