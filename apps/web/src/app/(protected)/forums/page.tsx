import { cookies } from "next/headers";
import { forumsServerApi } from "@/features/forums/api/forums.api";
import { ThreadCard } from "@/features/forums/components/ThreadCard";
import { NewThreadForm } from "@/features/forums/components/NewThreadForm";

export default async function ForumsPage() {
  const cookieHeader = (await cookies()).toString();
  const [categories, threadsPage] = await Promise.all([
    forumsServerApi.categories(cookieHeader),
    forumsServerApi.listThreads(cookieHeader),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-3xl font-semibold">Community Forums</h1>
        <p className="text-muted-foreground">
          Ask questions, share solutions, and troubleshoot together with other networking professionals.
        </p>
      </div>

      <NewThreadForm categories={categories} />

      <div className="flex flex-col gap-3">
        {threadsPage.data.map((thread) => (
          <ThreadCard key={thread.id} thread={thread} />
        ))}
        {threadsPage.data.length === 0 && <p className="text-muted-foreground">No threads yet — start one above.</p>}
      </div>
    </div>
  );
}
