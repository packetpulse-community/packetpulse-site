import { z } from "zod";
import { PaginationQuerySchema } from "./common";

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
  categoryId: z.string().uuid(),
  passingScorePct: z.coerce.number().int().min(1).max(100).default(70),
  timeLimitSeconds: z.coerce.number().int().min(1).optional(),
  // Assessment integrity (TASK-032). null = unlimited attempts.
  maxAttempts: z.coerce.number().int().min(1).max(100).nullable().default(3),
  retakeGapSeconds: z.coerce.number().int().min(0).max(31_536_000).default(0),
  expiresAt: z.coerce.date().nullable().optional(),
  isPublished: z.boolean().default(false),
  questions: z.array(QuizQuestionInputSchema).min(1).max(100),
});
export type CreateQuizDto = z.infer<typeof CreateQuizSchema>;

export const QuizListQuerySchema = PaginationQuerySchema.extend({
  categoryId: z.string().uuid().optional(),
});
export type QuizListQuery = z.infer<typeof QuizListQuerySchema>;

export const UpdateQuizSchema = CreateQuizSchema.omit({ questions: true }).partial();
export type UpdateQuizDto = z.infer<typeof UpdateQuizSchema>;

export const SubmitQuizAnswerSchema = z.object({
  questionId: z.string().uuid(),
  selectedOptionIds: z.array(z.string().uuid()),
});

export const SubmitQuizAttemptSchema = z.object({
  answers: z.array(SubmitQuizAnswerSchema).min(1),
});
export type SubmitQuizAttemptDto = z.infer<typeof SubmitQuizAttemptSchema>;

// What the attempt screen (SCR-034) needs, all computed by the server so the browser
// never decides on its own whether a start is allowed or how long is left.
export type QuizAttemptBlockReason = "limit_reached" | "retake_gap" | "quiz_expired" | "quiz_archived";

export interface QuizAttemptStatus {
  serverNow: string;
  maxAttempts: number | null;
  attemptsUsed: number;
  attemptsRemaining: number | null;
  canStart: boolean;
  blockedReason: QuizAttemptBlockReason | null;
  nextAttemptAt: string | null;
  quizExpiresAt: string | null;
  inProgress: { id: string; startedAt: string; deadlineAt: string | null } | null;
}
