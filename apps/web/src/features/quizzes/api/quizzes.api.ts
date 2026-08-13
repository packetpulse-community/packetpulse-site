import { apiFetch, apiFetchClient } from "@/shared/api/http-client";
import type { Paginated } from "@/features/blogs/api/blogs.api";

export interface QuizSummary {
  id: string;
  title: string;
  description: string;
  category: string;
  passingScorePct: number;
  timeLimitSeconds: number | null;
  isPublished: boolean;
  _count: { questions: number };
}

export interface QuizOption {
  id: string;
  optionText: string;
  position: number;
}

export interface QuizQuestion {
  id: string;
  questionText: string;
  questionType: "single_choice" | "multi_choice";
  position: number;
  points: number;
  options: QuizOption[];
}

// Note: the taking-view endpoint (GET /quizzes/:id) does NOT include _count —
// that's only on the list view's summarySelect on the backend. Deliberately
// Omit<> here rather than extending QuizSummary as-is, since that previously
// caused a runtime crash (quiz._count.questions on a response that had no
// _count field, caught via manual browser testing, not typecheck — the field
// was optional-looking in practice but TS had no way to know the two backend
// projections differ).
export interface QuizForTaking extends Omit<QuizSummary, "_count"> {
  questions: QuizQuestion[];
}

export interface QuizAttempt {
  id: string;
  quizId: string;
  status: "in_progress" | "submitted" | "expired";
  scorePct: number | null;
  passed: boolean | null;
}

export interface SubmitResult {
  attempt: QuizAttempt;
  scorePct: number;
  passed: boolean;
  certificate: { id: string; certificateNumber: string } | null;
}

export interface Certificate {
  id: string;
  certificateNumber: string;
  issuedAt: string;
  pdfUrl: string | null;
  quiz: { id: string; title: string; category: string };
}

export const quizzesServerApi = {
  list: (cookieHeader: string, query = "") => apiFetch<Paginated<QuizSummary>>(`/quizzes${query}`, { cookieHeader }),
  getForTaking: (id: string, cookieHeader: string) => apiFetch<QuizForTaking>(`/quizzes/${id}`, { cookieHeader }),
  myCertificates: (cookieHeader: string) => apiFetch<Certificate[]>("/quizzes/certificates/mine", { cookieHeader }),
};

export const quizzesClientApi = {
  startAttempt: (quizId: string) => apiFetchClient<QuizAttempt>(`/quizzes/${quizId}/attempts`, { method: "POST" }),
  submitAttempt: (quizId: string, attemptId: string, answers: { questionId: string; selectedOptionIds: string[] }[]) =>
    apiFetchClient<SubmitResult>(`/quizzes/${quizId}/attempts/${attemptId}/submit`, {
      method: "POST",
      body: JSON.stringify({ answers }),
    }),
};
