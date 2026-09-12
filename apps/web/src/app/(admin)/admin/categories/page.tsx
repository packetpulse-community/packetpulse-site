import { cookies } from "next/headers";
import { categoriesServerApi } from "@/features/categories/api/categories.api";
import { CategoriesTable } from "@/features/categories/components/CategoriesTable";

export default async function AdminCategoriesPage() {
  const cookieHeader = (await cookies()).toString();
  const categories = await categoriesServerApi.list(cookieHeader);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Categories</h1>
        <p className="text-muted-foreground">
          Shared across blogs, resources, recordings, quizzes, and forum threads — reorder, rename, or add new ones.
        </p>
      </div>

      <CategoriesTable categories={categories} />
    </div>
  );
}
