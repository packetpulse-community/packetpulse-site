import { cookies } from "next/headers";
import { adminServerApi } from "@/features/admin/api/admin.api";

export default async function AdminOverviewPage() {
  const cookieHeader = (await cookies()).toString();
  const stats = await adminServerApi.stats(cookieHeader);

  const cards = [
    { label: "Total users", value: stats.totalUsers },
    { label: "Pending approval", value: stats.pendingApproval },
    { label: "Blog posts", value: stats.totalBlogPosts },
    { label: "Resources", value: stats.totalResources },
    { label: "Pending resources", value: stats.pendingResources },
    { label: "Recordings", value: stats.totalRecordings },
    { label: "Pending recordings", value: stats.pendingRecordings },
    { label: "Forum threads", value: stats.totalForumThreads },
    { label: "Quizzes", value: stats.totalQuizzes },
    { label: "Certificates issued", value: stats.certificatesIssued },
  ];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Admin Overview</h1>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((card) => (
          <div key={card.label} className="rounded-lg border border-border bg-card p-4 text-card-foreground">
            <p className="text-2xl font-semibold">{card.value}</p>
            <p className="text-xs text-muted-foreground">{card.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
