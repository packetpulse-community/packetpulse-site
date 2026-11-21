import { cookies } from "next/headers";
import Link from "next/link";
import { FORUM_REPORT_STATUSES } from "@packetpulse/types";
import { forumsServerApi } from "@/features/forums/api/forums.api";
import { ReportsQueue } from "@/features/forums/components/ReportsQueue";
import { Pagination } from "@/shared/components/Pagination";

export const metadata = { title: "Reports" };

// A minimal moderator list for TASK-026. The full queue (SLA timers, appeals) belongs to TASK-043.
export default async function AdminForumReportsPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  const params = await searchParams;
  const status = FORUM_REPORT_STATUSES.find((s) => s === params.status) ?? "open";
  const cookieHeader = (await cookies()).toString();
  const q = new URLSearchParams({ status, limit: "20" });
  if (params.page) q.set("page", params.page);
  const { data, page, totalPages } = await forumsServerApi.listReports(cookieHeader, `?${q.toString()}`);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Reported posts</h1>
        <p className="text-muted-foreground">Urgent reports (exposed credentials, harassment) are answered within 4 hours; the rest within 24 hours.</p>
      </div>
      <nav aria-label="Report status" className="flex gap-3 text-sm">
        {FORUM_REPORT_STATUSES.map((s) => (
          <Link key={s} href={`/admin/forums/reports?status=${s}`} aria-current={s === status ? "page" : undefined} className={s === status ? "font-semibold underline" : "underline-offset-2 hover:underline"}>
            {s === "open" ? "Open" : s === "dismissed" ? "Dismissed" : "Removed"}
          </Link>
        ))}
        <Link href="/admin/forums" className="ml-auto underline">
          All threads
        </Link>
      </nav>
      <ReportsQueue reports={data} status={status} />
      <Pagination page={page} totalPages={totalPages} basePath="/admin/forums/reports" />
    </div>
  );
}
