import { QuizBuilder } from "@/features/quizzes/components/QuizBuilder";

// No access check needed here — (admin)/layout.tsx already redirects anyone
// who isn't admin/super_admin before this renders (platform-mode plan §5).
export default function NewAdminQuizPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Create a Quiz</h1>
      <QuizBuilder />
    </div>
  );
}
