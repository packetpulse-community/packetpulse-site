import { cookies } from "next/headers";
import { quizzesServerApi } from "@/features/quizzes/api/quizzes.api";
import { QuizAttempt } from "@/features/quizzes/components/QuizAttempt";
import { AttemptHistory } from "@/features/quizzes/components/AttemptHistory";

export default async function QuizDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieHeader = (await cookies()).toString();
  const [quiz, mine] = await Promise.all([
    quizzesServerApi.getForTaking(id, cookieHeader),
    quizzesServerApi.myAttempts(id, cookieHeader),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">{quiz.title}</h1>
        <p className="text-text-secondary">{quiz.description}</p>
      </header>

      <QuizAttempt quiz={quiz} status={mine.status} />

      <AttemptHistory attempts={mine.attempts} />
    </div>
  );
}
