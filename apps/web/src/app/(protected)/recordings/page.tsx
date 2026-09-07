import Link from "next/link";
import { cookies } from "next/headers";
import { recordingsServerApi } from "@/features/recordings/api/recordings.api";
import { RecordingCard } from "@/features/recordings/components/RecordingCard";
import { RecordingFilters } from "@/features/recordings/components/RecordingFilters";
import { Pagination } from "@/shared/components/Pagination";
import { CalloutBox } from "@/shared/components/CalloutBox";
import { buttonVariants } from "@/shared/ui/primitives/Button";
import { cn } from "@/shared/utils/cn";

interface RecordingsPageProps {
  searchParams: Promise<{ search?: string; category?: string; tag?: string; page?: string }>;
}

export default async function RecordingsPage({ searchParams }: RecordingsPageProps) {
  const params = await searchParams;
  const cookieHeader = (await cookies()).toString();

  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.category) query.set("category", params.category);
  if (params.tag) query.set("tag", params.tag);
  if (params.page) query.set("page", params.page);
  const queryString = query.toString() ? `?${query.toString()}` : "";

  const { data: recordings, page, totalPages } = await recordingsServerApi.list(cookieHeader, queryString);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-3xl font-semibold">Session Recordings</h1>
        <p className="text-muted-foreground">
          Watch recorded sessions from industry experts covering networking topics from fundamentals to advanced.
        </p>
      </div>

      <RecordingFilters />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {recordings.map((recording) => (
          <RecordingCard key={recording.id} recording={recording} />
        ))}
        {recordings.length === 0 && <p className="text-muted-foreground">No recordings yet.</p>}
      </div>

      <Pagination page={page} totalPages={totalPages} basePath="/recordings" />

      <CalloutBox
        title="Host a Session"
        description="Have expertise worth recording? Get in touch to host a session for the community."
      >
        <Link href="/contact" className={cn(buttonVariants({ variant: "gradient" }))}>
          Get in Touch →
        </Link>
      </CalloutBox>
    </div>
  );
}
