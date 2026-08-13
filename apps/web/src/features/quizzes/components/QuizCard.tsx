import Link from "next/link";
import type { QuizSummary } from "../api/quizzes.api";

export function QuizCard({ quiz }: { quiz: QuizSummary }) {
  return (
    <Link
      href={`/quizzes/${quiz.id}`}
      className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 text-card-foreground transition hover:border-primary"
    >
      <h2 className="text-lg font-semibold">{quiz.title}</h2>
      <p className="line-clamp-2 text-sm text-muted-foreground">{quiz.description}</p>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>{quiz.category}</span>
        <span>·</span>
        <span>{quiz._count.questions} questions</span>
        <span>·</span>
        <span>Pass at {quiz.passingScorePct}%</span>
      </div>
    </Link>
  );
}
