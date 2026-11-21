import Link from "next/link";
import { cookies } from "next/headers";
import { quizzesServerApi } from "@/features/quizzes/api/quizzes.api";
import { QuizCard } from "@/features/quizzes/components/QuizCard";
import { getCurrentUser } from "@/shared/auth/session";
import { buttonVariants } from "@/shared/ui/primitives/Button";
import { cn } from "@/shared/utils/cn";
import { EmptyState } from "@/shared/ui/primitives/EmptyState";

export default async function QuizzesPage() {
  const cookieHeader = (await cookies()).toString();
  const [{ data: quizzes }, user] = await Promise.all([quizzesServerApi.list(cookieHeader), getCurrentUser()]);
  const isSuperAdmin = user?.roles.includes("super_admin") ?? false;
  const canAuthor = isSuperAdmin || (user?.permissions.includes("quizzes:author") ?? false);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-3xl font-semibold">Test Your Knowledge</h1>
        <p className="text-text-secondary">
          Take quizzes on networking topics, track your progress, and earn certificates as you go.
        </p>
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
        {quizzes.length === 0 && (
          <EmptyState
            title="No quizzes yet"
            description={
              canAuthor
                ? "Members take quizzes here to test their knowledge and earn certificates. None is published yet, so create the first one."
                : "Members take quizzes here to test their knowledge and earn certificates. None is published yet, so read a resource while you wait."
            }
            action={canAuthor ? { label: "Create a quiz", href: "/quizzes/new" } : { label: "Browse resources", href: "/resources" }}
          />
        )}
      </div>
    </div>
  );
}
