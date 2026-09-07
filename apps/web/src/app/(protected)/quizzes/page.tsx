import Link from "next/link";
import { cookies } from "next/headers";
import { quizzesServerApi } from "@/features/quizzes/api/quizzes.api";
import { QuizCard } from "@/features/quizzes/components/QuizCard";
import { getCurrentUser } from "@/shared/auth/session";
import { buttonVariants } from "@/shared/ui/primitives/Button";
import { cn } from "@/shared/utils/cn";

export default async function QuizzesPage() {
  const cookieHeader = (await cookies()).toString();
  const [{ data: quizzes }, user] = await Promise.all([quizzesServerApi.list(cookieHeader), getCurrentUser()]);
  const isSuperAdmin = user?.roles.includes("super_admin") ?? false;
  const canAuthor = isSuperAdmin || (user?.permissions.includes("quizzes:author") ?? false);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Quizzes</h1>
        {canAuthor && (
          <Link href="/quizzes/new" className={cn(buttonVariants({ variant: "gradient" }))}>
            Create Quiz
          </Link>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {quizzes.map((quiz) => (
          <QuizCard key={quiz.id} quiz={quiz} />
        ))}
        {quizzes.length === 0 && <p className="text-muted-foreground">No quizzes published yet.</p>}
      </div>
    </div>
  );
}
