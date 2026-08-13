import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service";

@Injectable()
export class AdminAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async stats() {
    const [
      totalUsers,
      pendingApproval,
      totalBlogPosts,
      totalResources,
      pendingResources,
      totalRecordings,
      pendingRecordings,
      totalForumThreads,
      totalQuizzes,
      certificatesIssued,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { isApproved: false, emailVerified: true } }),
      this.prisma.blogPost.count(),
      this.prisma.resource.count(),
      this.prisma.resource.count({ where: { isApproved: false } }),
      this.prisma.recording.count(),
      this.prisma.recording.count({ where: { isApproved: false } }),
      this.prisma.forumThread.count(),
      this.prisma.quiz.count(),
      this.prisma.certificate.count({ where: { revokedAt: null } }),
    ]);

    return {
      totalUsers,
      pendingApproval,
      totalBlogPosts,
      totalResources,
      pendingResources,
      totalRecordings,
      pendingRecordings,
      totalForumThreads,
      totalQuizzes,
      certificatesIssued,
    };
  }

  // Registration trend for the last 30 days, grouped by day — real user counts,
  // unlike the old app's dashboard which mixed real counts with Math.random() data
  // for everything else (plan §3 — network-tools stays mocked, but analytics here
  // is entirely real since it aggregates actual rows).
  async registrationTrend() {
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const users = await this.prisma.user.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true },
    });

    const byDay = new Map<string, number>();
    for (const { createdAt } of users) {
      const key = createdAt.toISOString().slice(0, 10);
      byDay.set(key, (byDay.get(key) ?? 0) + 1);
    }
    return [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count }));
  }

  async roleDistribution() {
    const roles = await this.prisma.role.findMany({ include: { _count: { select: { users: true } } } });
    return roles.map((role) => ({ role: role.name, count: role._count.users }));
  }
}
