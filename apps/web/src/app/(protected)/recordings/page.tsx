import { cookies } from "next/headers";
import { recordingsServerApi } from "@/features/recordings/api/recordings.api";
import { RecordingCard } from "@/features/recordings/components/RecordingCard";
import { RecordingFilters } from "@/features/recordings/components/RecordingFilters";
import { Pagination } from "@/shared/components/Pagination";

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
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Recordings</h1>
      <RecordingFilters />
      <div className="grid gap-4 sm:grid-cols-2">
        {recordings.map((recording) => (
          <RecordingCard key={recording.id} recording={recording} />
        ))}
        {recordings.length === 0 && <p className="text-muted-foreground">No recordings yet.</p>}
      </div>
      <Pagination page={page} totalPages={totalPages} basePath="/recordings" />
    </div>
  );
}
