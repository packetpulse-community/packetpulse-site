"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { QuizAttemptStatus } from "@packetpulse/types";
import { cn } from "@/shared/utils/cn";
import { ApiError } from "@/shared/api/http-client";
import { buttonVariants } from "@/shared/ui/primitives/Button";
import { quizzesClientApi } from "../api/quizzes.api";
import type { QuizForTaking, SubmitResult } from "../api/quizzes.api";
import { clockOffsetMs, describeBlock, formatClock, remainingSeconds } from "../api/attempt-timer";

type AnswerMap = Record<string, string[]>; // questionId -> selected option ids

function errorMessage(err: unknown, fallback: string) {
  return err instanceof ApiError ? ((err.body as { message?: string })?.message ?? fallback) : fallback;
}

// Countdown against the server's clock. The server rejects a submission past the
// deadline (plus a few seconds of grace); this badge only shows how long is left.
function TimerBadge({ deadlineAt, offsetMs, onExpire }: { deadlineAt: string; offsetMs: number; onExpire: () => void }) {
  const [remaining, setRemaining] = useState(() => remainingSeconds(deadlineAt, offsetMs, Date.now()) ?? 0);
  const expired = useRef(onExpire);
  expired.current = onExpire;

  useEffect(() => {
    const tick = () => {
      const left = remainingSeconds(deadlineAt, offsetMs, Date.now()) ?? 0;
      setRemaining(left);
      if (left === 0) expired.current();
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [deadlineAt, offsetMs]);

  const low = remaining <= 30;

  return (
    <span
      role="timer"
      aria-label={`Time remaining ${formatClock(remaining)}`}
      className={cn(
        "rounded-md px-2 py-1 text-sm font-medium tabular-nums",
        low ? "bg-danger-soft text-danger" : "text-text-secondary",
      )}
    >
      {low ? <span aria-hidden="true">⚠ </span> : null}
      {formatClock(remaining)}
      {low ? <span className="ml-1">left</span> : null}
    </span>
  );
}

interface RunningAttempt {
  id: string;
  deadlineAt: string | null;
  offsetMs: number;
}

export function QuizAttempt({ quiz, status }: { quiz: QuizForTaking; status: QuizAttemptStatus }) {
  const router = useRouter();
  // The page was rendered just now, so serverNow is as fresh as the response itself.
  const [running, setRunning] = useState<RunningAttempt | null>(() =>
    status.inProgress
      ? {
          id: status.inProgress.id,
          deadlineAt: status.inProgress.deadlineAt,
          offsetMs: clockOffsetMs(status.serverNow, Date.now()),
        }
      : null,
  );
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [timeUp, setTimeUp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startMutation = useMutation({
    mutationFn: () => quizzesClientApi.startAttempt(quiz.id),
    onSuccess: (attempt) => {
      setError(null);
      setTimeUp(false);
      setRunning({ id: attempt.id, deadlineAt: attempt.deadlineAt, offsetMs: clockOffsetMs(attempt.serverNow, Date.now()) });
    },
    onError: (err) => {
      setError(errorMessage(err, "Could not start the quiz"));
      router.refresh(); // pick up the server's current attempt count and block reason
    },
  });

  const submitMutation = useMutation({
    mutationFn: () => {
      if (!running) throw new Error("No active attempt");
      const payload = quiz.questions.map((q) => ({ questionId: q.id, selectedOptionIds: answers[q.id] ?? [] }));
      return quizzesClientApi.submitAttempt(quiz.id, running.id, payload);
    },
    onSuccess: (res) => {
      setResult(res);
      router.refresh();
    },
    onError: (err) => {
      setError(errorMessage(err, "Could not submit the quiz"));
      if (err instanceof ApiError && err.status === 409) {
        setTimeUp(true);
        router.refresh();
      }
    },
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
      <div className="rounded-grove-card border border-border bg-surface text-text flex flex-col gap-4 p-6 text-center">
        <h2 className={cn("text-2xl font-semibold", result.passed ? "text-success" : "text-danger")}>
          <span aria-hidden="true">{result.passed ? "✓ " : "✕ "}</span>
          {result.passed ? "You passed!" : "Not quite there"}
        </h2>
        <p className="text-lg">Score: {result.scorePct}%</p>
        {result.certificate ? (
          <div className="flex flex-col gap-2">
            <p className="text-text-secondary">Certificate issued: {result.certificate.certificateNumber}</p>
            <Link href="/certificates" className="text-primary-text underline">
              View my certificates
            </Link>
          </div>
        ) : (
          <p className="text-text-secondary">You need {quiz.passingScorePct}% to pass.</p>
        )}
      </div>
    );
  }

  if (timeUp && running) {
    return (
      <div role="alert" className="rounded-grove-card border border-border bg-surface text-text flex flex-col gap-2 p-6">
        <h2 className="text-lg font-semibold">Time is up</h2>
        <p className="text-text-secondary">{error ?? "The time limit for this attempt has passed, so it can no longer be submitted."}</p>
        <p className="text-sm text-text-secondary">This attempt still counts towards your attempt limit.</p>
        <button
          onClick={() => {
            setRunning(null);
            setTimeUp(false);
            setError(null);
            router.refresh();
          }}
          className={cn(buttonVariants({ variant: "outline" }), "w-fit")}
        >
          Back to quiz
        </button>
      </div>
    );
  }

  if (!running) {
    const blocked = describeBlock(status.blockedReason, status.nextAttemptAt);
    return (
      <div className="rounded-grove-card border border-border bg-surface text-text flex flex-col gap-4 p-6">
        <p className="text-text-secondary">
          {quiz.questions.length} questions · pass at {quiz.passingScorePct}%
          {quiz.timeLimitSeconds ? ` · ${formatClock(quiz.timeLimitSeconds)} time limit` : ""}
        </p>
        <p className="text-sm" data-testid="attempts-remaining">
          {status.attemptsRemaining === null
            ? "Unlimited attempts"
            : `${status.attemptsRemaining} of ${status.maxAttempts} attempts remaining`}
          {status.quizExpiresAt && !status.blockedReason ? ` · closes ${new Date(status.quizExpiresAt).toLocaleString()}` : ""}
        </p>
        {quiz.timeLimitSeconds ? (
          <p className="text-sm text-text-secondary">The timer starts when you press Start and cannot be paused. Late answers are not accepted.</p>
        ) : null}
        {(blocked || error) && (
          <p role="alert" className="text-sm text-danger">
            {error ?? blocked}
          </p>
        )}
        <button
          onClick={() => startMutation.mutate()}
          disabled={startMutation.isPending || !status.canStart}
          className={cn(buttonVariants({ variant: "gradient" }), "w-fit")}
        >
          {startMutation.isPending ? "Starting…" : status.attemptsUsed > 0 ? "Retake quiz" : "Start quiz"}
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
      {running.deadlineAt && (
        <div className="rounded-grove-card border border-border bg-surface text-text sticky top-2 z-10 flex items-center justify-between p-3">
          <span className="text-sm text-text-secondary">Time remaining</span>
          <TimerBadge deadlineAt={running.deadlineAt} offsetMs={running.offsetMs} onExpire={() => setTimeUp(true)} />
        </div>
      )}

      {quiz.questions.map((question, qIndex) => (
        <fieldset key={question.id} className="rounded-grove-card border border-border bg-surface text-text flex flex-col gap-2 p-4">
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

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitMutation.isPending}
        className={cn(buttonVariants({ variant: "gradient" }), "w-fit")}
      >
        {submitMutation.isPending ? "Submitting…" : "Submit quiz"}
      </button>
    </form>
  );
}
