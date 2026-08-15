import { cookies } from "next/headers";
import {
  Award,
  BarChart3,
  BookOpen,
  FileText,
  HelpCircle,
  MessageSquare,
  Users,
  UserCheck,
  Video,
} from "lucide-react";
import { adminServerApi } from "@/features/admin/api/admin.api";
import { StatsCard } from "@/features/admin/components/StatsCard";

export default async function AdminOverviewPage() {
  const cookieHeader = (await cookies()).toString();
  const stats = await adminServerApi.stats(cookieHeader);

  const cards = [
    { title: "Total users", value: stats.totalUsers, icon: Users, href: "/admin/users" },
    {
      title: "Pending approval",
      value: stats.pendingApproval,
      icon: UserCheck,
      href: "/admin/users?approved=false",
      highlight: stats.pendingApproval > 0,
    },
    { title: "Blog posts", value: stats.totalBlogPosts, icon: BookOpen },
    { title: "Resources", value: stats.totalResources, icon: FileText, href: "/admin/resources" },
    {
      title: "Pending resources",
      value: stats.pendingResources,
      icon: FileText,
      href: "/admin/resources",
      highlight: stats.pendingResources > 0,
    },
    { title: "Recordings", value: stats.totalRecordings, icon: Video, href: "/admin/recordings" },
    {
      title: "Pending recordings",
      value: stats.pendingRecordings,
      icon: Video,
      href: "/admin/recordings",
      highlight: stats.pendingRecordings > 0,
    },
    { title: "Forum threads", value: stats.totalForumThreads, icon: MessageSquare },
    { title: "Quizzes", value: stats.totalQuizzes, icon: HelpCircle },
    { title: "Certificates issued", value: stats.certificatesIssued, icon: Award },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-semibold">Admin Overview</h1>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((card) => (
          <StatsCard key={card.title} {...card} />
        ))}
      </div>
    </div>
  );
}
