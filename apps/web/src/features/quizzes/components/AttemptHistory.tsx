import { Badge } from "@/shared/ui/primitives/Badge";
import type { QuizAttemptWithCertificate } from "../api/quizzes.api";

export function AttemptHistory({ attempts }: { attempts: QuizAttemptWithCertificate[] }) {
  if (attempts.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Your Past Attempts</h2>
      <ul className="flex flex-col gap-2">
        {attempts.map((attempt) => (
          <li key={attempt.id} className="glass-panel flex items-center justify-between rounded-md p-3">
            <div>
              <p className="text-sm">{new Date(attempt.startedAt).toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">
                {attempt.status === "in_progress" ? "In progress" : `Score: ${attempt.scorePct}%`}
              </p>
            </div>
            {attempt.passed !== null && (
              <Badge variant={attempt.passed ? "success" : "danger"}>{attempt.passed ? "Passed" : "Failed"}</Badge>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
