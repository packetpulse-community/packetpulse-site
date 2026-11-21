import { cookies } from "next/headers";
import { forumsServerApi } from "@/features/forums/api/forums.api";
import { ThreadCard } from "@/features/forums/components/ThreadCard";
import { NewThreadForm } from "@/features/forums/components/NewThreadForm";
import Link from "next/link";
import { FORUM_MODE_LABELS, FORUM_THREAD_MODES } from "@packetpulse/types";
import { cn } from "@/shared/utils/cn";
import { buttonVariants } from "@/shared/ui/primitives/Button";
import { EmptyState } from "@/shared/ui/primitives/EmptyState";

export default async function ForumsPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const { mode } = await searchParams;
  const activeMode = FORUM_THREAD_MODES.find((m) => m === mode);
  const cookieHeader = (await cookies()).toString();
  const [categories, threadsPage] = await Promise.all([
    forumsServerApi.categories(cookieHeader),
    forumsServerApi.listThreads(cookieHeader, activeMode ? `?mode=${activeMode}` : ""),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-3xl font-semibold">Community Forums</h1>
        <p className="text-muted-foreground">
          Ask questions, share solutions, and troubleshoot together with other networking professionals.
        </p>
      </div>

      <nav aria-label="Filter by question type" className="flex flex-wrap items-center justify-center gap-2">
        {[undefined, ...FORUM_THREAD_MODES].map((m) => (
          <Link
            key={m ?? "all"}
            href={m ? `/forums?mode=${m}` : "/forums"}
            aria-current={m === activeMode ? "page" : undefined}
            className={cn(buttonVariants({ variant: m === activeMode ? "default" : "outline", size: "sm" }))}
          >
            {m ? FORUM_MODE_LABELS[m] : "All questions"}
          </Link>
        ))}
        <Link href="/forums/guidelines" className="text-sm underline">
          Community guidelines
        </Link>
      </nav>

      <div id="new-thread">
        <NewThreadForm categories={categories} />
      </div>

      <div className="flex flex-col gap-3">
        {threadsPage.data.map((thread) => (
          <ThreadCard key={thread.id} thread={thread} />
        ))}
        {threadsPage.data.length === 0 && (
          <EmptyState
            title={activeMode ? `No ${FORUM_MODE_LABELS[activeMode]} questions yet` : "No threads yet"}
            description="Members ask questions and share fixes in threads. None has been started yet, so ask the first question."
            action={{ label: "Start a thread", href: "#new-thread" }}
          />
        )}
      </div>
    </div>
  );
}
