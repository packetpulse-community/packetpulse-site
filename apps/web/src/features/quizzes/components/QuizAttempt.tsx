"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { quizzesClientApi } from "../api/quizzes.api";
import type { QuizForTaking, SubmitResult } from "../api/quizzes.api";

type AnswerMap = Record<string, string[]>; // questionId -> selected option ids

export function QuizAttempt({ quiz }: { quiz: QuizForTaking }) {
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [result, setResult] = useState<SubmitResult | null>(null);

  const startMutation = useMutation({
    mutationFn: () => quizzesClientApi.startAttempt(quiz.id),
    onSuccess: (attempt) => setAttemptId(attempt.id),
  });

  const submitMutation = useMutation({
    mutationFn: () => {
      if (!attemptId) throw new Error("No active attempt");
      const payload = quiz.questions.map((q) => ({ questionId: q.id, selectedOptionIds: answers[q.id] ?? [] }));
      return quizzesClientApi.submitAttempt(quiz.id, attemptId, payload);
    },
    onSuccess: setResult,
  });

  function toggleOption(questionId: string, optionId: string, isSingleChoice: boolean) {
    setAnswers((prev) => {
      const current = prev[questionId] ?? [];
      if (isSingleChoice) return { ...prev, [questionId]: [optionId] };
      const next = current.includes(optionId) ? current.filter((id) => id !== optionId) : [...current, optionId];
      return { ...prev, [questionId]: next };
    });
  }

  if (result) {
    return (
      <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6 text-center">
        <h2 className="text-2xl font-semibold">{result.passed ? "You passed! 🎉" : "Not quite there"}</h2>
        <p className="text-lg">Score: {result.scorePct}%</p>
        {result.certificate ? (
          <div className="flex flex-col gap-2">
            <p className="text-muted-foreground">Certificate issued: {result.certificate.certificateNumber}</p>
            <Link href="/certificates" className="text-primary underline">
              View my certificates
            </Link>
          </div>
        ) : (
          <p className="text-muted-foreground">You need {quiz.passingScorePct}% to pass. Try again later.</p>
        )}
      </div>
    );
  }

  if (!attemptId) {
    return (
      <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6">
        <p className="text-muted-foreground">
          {quiz.questions.length} questions · pass at {quiz.passingScorePct}%
        </p>
        <button
          onClick={() => startMutation.mutate()}
          disabled={startMutation.isPending}
          className="w-fit rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
        >
          {startMutation.isPending ? "Starting…" : "Start quiz"}
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submitMutation.mutate();
      }}
      className="flex flex-col gap-6"
    >
      {quiz.questions.map((question, qIndex) => (
        <fieldset key={question.id} className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
          <legend className="px-1 font-medium">
            {qIndex + 1}. {question.questionText}
          </legend>
          {question.options.map((option) => {
            const inputType = question.questionType === "single_choice" ? "radio" : "checkbox";
            return (
              <label key={option.id} className="flex items-center gap-2 text-sm">
                <input
                  type={inputType}
                  name={question.id}
                  checked={(answers[question.id] ?? []).includes(option.id)}
                  onChange={() => toggleOption(question.id, option.id, question.questionType === "single_choice")}
                />
                {option.optionText}
              </label>
            );
          })}
        </fieldset>
      ))}

      <button
        type="submit"
        disabled={submitMutation.isPending}
        className="w-fit rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
      >
        {submitMutation.isPending ? "Submitting…" : "Submit quiz"}
      </button>
    </form>
  );
}
