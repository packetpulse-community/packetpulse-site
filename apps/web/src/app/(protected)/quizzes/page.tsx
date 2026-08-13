import { cookies } from "next/headers";
import { quizzesServerApi } from "@/features/quizzes/api/quizzes.api";
import { QuizCard } from "@/features/quizzes/components/QuizCard";

export default async function QuizzesPage() {
  const cookieHeader = (await cookies()).toString();
  const { data: quizzes } = await quizzesServerApi.list(cookieHeader);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Quizzes</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        {quizzes.map((quiz) => (
          <QuizCard key={quiz.id} quiz={quiz} />
        ))}
        {quizzes.length === 0 && <p className="text-muted-foreground">No quizzes published yet.</p>}
      </div>
    </div>
  );
}
