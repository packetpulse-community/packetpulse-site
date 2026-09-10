import { cookies } from "next/headers";
import { quizzesServerApi } from "@/features/quizzes/api/quizzes.api";
import { QuizMetaEditForm } from "@/features/quizzes/components/QuizMetaEditForm";

// Metadata (title/description/category/passing score/time limit/publish state) is
// editable via QuizMetaEditForm (PUT /quizzes/:id). Question/option editing isn't
// exposed here — questions are shown read-only below the form.
export default async function EditQuizPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieHeader = (await cookies()).toString();
  const quiz = await quizzesServerApi.getForAuthoring(id, cookieHeader);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{quiz.title}</h1>
      </header>

      <QuizMetaEditForm quiz={quiz} />

      <p className="text-sm text-muted-foreground">Questions (read-only)</p>

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
