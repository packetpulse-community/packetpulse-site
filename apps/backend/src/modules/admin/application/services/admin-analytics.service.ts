import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service";
import { AdminActivityLogService } from "./admin-activity-log.service";
import type { AdminDateRangeQueryDto } from "../dto/admin.dto";

function defaultRange(query: AdminDateRangeQueryDto) {
  const toDate = query.toDate ?? new Date();
  const fromDate = query.fromDate ?? new Date(toDate.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { fromDate, toDate };
}

@Injectable()
export class AdminAnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: AdminActivityLogService,
  ) {}

  // fromDate/toDate drive the dashboard's date-range filter for the two
  // previously-fake "Active Users"/"New Users" stats (the old app either reused
  // totalUsers or hardcoded 0 for these — see plan discussion) — both are real
  // aggregate counts here.
  async stats(query: AdminDateRangeQueryDto = {}) {
    const { fromDate, toDate } = defaultRange(query);

    const [
      totalUsers,
      activeUsers,
      newUsers,
      pendingApproval,
      totalBlogPosts,
      pendingBlogs,
      totalResources,
      pendingResources,
      totalRecordings,
      pendingRecordings,
      totalForumThreads,
      totalQuizzes,
      certificatesIssued,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { lastLoginAt: { gte: fromDate, lte: toDate } } }),
      this.prisma.user.count({ where: { createdAt: { gte: fromDate, lte: toDate } } }),
      this.prisma.user.count({ where: { isApproved: false, emailVerified: true } }),
      this.prisma.blogPost.count(),
      this.prisma.blogPost.count({ where: { isApproved: false } }),
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
      activeUsers,
      newUsers,
      pendingApproval,
      totalBlogPosts,
      pendingBlogs,
      totalResources,
      pendingResources,
      totalRecordings,
      pendingRecordings,
      totalForumThreads,
      totalQuizzes,
      certificatesIssued,
    };
  }

  // Registration trend over the given range (default trailing 30 days), grouped by
  // day — real user counts, unlike the old app's dashboard which mixed real counts
  // with Math.random() data for everything else (plan §3 — network-tools stays
  // mocked, but analytics here is entirely real since it aggregates actual rows).
  async registrationTrend(query: AdminDateRangeQueryDto = {}) {
    const { fromDate, toDate } = defaultRange(query);

    const users = await this.prisma.user.findMany({
      where: { createdAt: { gte: fromDate, lte: toDate } },
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

  // Real replacement for the old dashboard's "Activity Distribution" pie chart,
  // which read a field (analytics.activity.categories/counts) the old backend
  // never sent and silently fell back to 4 hardcoded placeholder colors with no
  // real data behind them. This groups the new admin_activity_logs table by action.
  activityDistribution() {
    return this.activityLog.distribution();
  }
}
