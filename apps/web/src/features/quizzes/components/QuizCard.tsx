import Link from "next/link";
import { cardVariants } from "@/shared/ui/primitives/Card";
import { cn } from "@/shared/utils/cn";
import type { QuizSummary } from "../api/quizzes.api";

export function QuizCard({ quiz }: { quiz: QuizSummary }) {
  return (
    <Link href={`/quizzes/${quiz.id}`} className={cn(cardVariants({ variant: "glass" }), "flex flex-col gap-2 p-4")}>
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
