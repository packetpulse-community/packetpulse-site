import { redirect } from "next/navigation";
import { getCurrentUser } from "@/shared/auth/session";
import { QuizBuilder } from "@/features/quizzes/components/QuizBuilder";

export default async function NewQuizPage() {
  const user = await getCurrentUser();
  const isSuperAdmin = user?.roles.includes("super_admin") ?? false;
  const canAuthor = isSuperAdmin || (user?.permissions.includes("quizzes:author") ?? false);
  if (!canAuthor) redirect("/quizzes");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Create a Quiz</h1>
      <QuizBuilder />
    </div>
  );
}
