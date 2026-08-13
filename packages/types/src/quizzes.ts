import { z } from "zod";
import { PaginationQuerySchema } from "./common";
import { BlogCategorySchema } from "./content";

export const QuizQuestionOptionInputSchema = z.object({
  optionText: z.string().min(1).max(500),
  isCorrect: z.boolean().default(false),
});

export const QuizQuestionInputSchema = z.object({
  questionText: z.string().min(1).max(1000),
  questionType: z.enum(["single_choice", "multi_choice"]),
  points: z.coerce.number().int().min(1).default(1),
  options: z.array(QuizQuestionOptionInputSchema).min(2).max(10),
});

export const CreateQuizSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  category: BlogCategorySchema.default("general"),
  passingScorePct: z.coerce.number().int().min(1).max(100).default(70),
  timeLimitSeconds: z.coerce.number().int().min(1).optional(),
  isPublished: z.boolean().default(false),
  questions: z.array(QuizQuestionInputSchema).min(1).max(100),
});
export type CreateQuizDto = z.infer<typeof CreateQuizSchema>;

export const QuizListQuerySchema = PaginationQuerySchema.extend({
  category: BlogCategorySchema.optional(),
});
export type QuizListQuery = z.infer<typeof QuizListQuerySchema>;

export const SubmitQuizAnswerSchema = z.object({
  questionId: z.string().uuid(),
  selectedOptionIds: z.array(z.string().uuid()),
});

export const SubmitQuizAttemptSchema = z.object({
  answers: z.array(SubmitQuizAnswerSchema).min(1),
});
export type SubmitQuizAttemptDto = z.infer<typeof SubmitQuizAttemptSchema>;
