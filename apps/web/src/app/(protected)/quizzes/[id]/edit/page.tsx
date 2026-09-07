import { cookies } from "next/headers";
import { quizzesServerApi } from "@/features/quizzes/api/quizzes.api";

// Read-only view — the backend has GET /quizzes/:id/edit (getForAuthoring) but no
// PUT/PATCH to persist changes yet, so this surfaces the authoring data without a
// working save action rather than building a form that can't actually submit.
export default async function EditQuizPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieHeader = (await cookies()).toString();
  const quiz = await quizzesServerApi.getForAuthoring(id, cookieHeader);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{quiz.title}</h1>
        <p className="text-muted-foreground">{quiz.description}</p>
        <p className="text-sm text-muted-foreground">
          {quiz.category} · pass at {quiz.passingScorePct}% · {quiz.isPublished ? "Published" : "Draft"}
        </p>
        <p className="text-xs text-muted-foreground">
          Editing isn&apos;t available yet — this is a read-only view of the quiz structure.
        </p>
      </header>

      {quiz.questions.map((question, qIndex) => (
        <div key={question.id} className="glass-panel flex flex-col gap-2 rounded-lg p-4">
          <p className="font-medium">
            {qIndex + 1}. {question.questionText}
          </p>
          <ul className="flex flex-col gap-1 pl-4 text-sm text-muted-foreground">
            {question.options.map((option) => (
              <li key={option.id}>
                {option.isCorrect ? "✅" : "◻️"} {option.optionText}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
