import { cookies } from "next/headers";
import { quizzesServerApi } from "@/features/quizzes/api/quizzes.api";
import { AdminQuizzesTable } from "@/features/admin/components/AdminQuizzesTable";
import { Pagination } from "@/shared/components/Pagination";

interface AdminQuizzesPageProps {
  searchParams: Promise<{ category?: string; page?: string }>;
}

export default async function AdminQuizzesPage({ searchParams }: AdminQuizzesPageProps) {
  const params = await searchParams;
  const cookieHeader = (await cookies()).toString();

  const query = new URLSearchParams();
  if (params.category) query.set("category", params.category);
  if (params.page) query.set("page", params.page);
  query.set("limit", "50");
  const queryString = `?${query.toString()}`;

  const { data: quizzes, page, totalPages } = await quizzesServerApi.list(cookieHeader, queryString);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Quizzes</h1>
        <p className="text-muted-foreground">Manage all quizzes — publish, edit, or remove.</p>
      </div>

      <AdminQuizzesTable quizzes={quizzes} />

      <Pagination page={page} totalPages={totalPages} basePath="/admin/quizzes" />
    </div>
  );
}
