import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service";
import { PresenceService } from "../../../realtime";

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly presence: PresenceService,
  ) {}

  async stats() {
    const [totalUsers, totalBlogPosts, totalResources, totalRecordings, totalForumThreads, onlineCount] =
      await Promise.all([
        this.prisma.user.count({ where: { isApproved: true } }),
        this.prisma.blogPost.count({ where: { isPublished: true } }),
        this.prisma.resource.count({ where: { isApproved: true } }),
        this.prisma.recording.count({ where: { isApproved: true } }),
        this.prisma.forumThread.count(),
        this.presence.onlineCount(),
      ]);

    return {
      // Real counts, queried directly.
      real: { totalUsers, totalBlogPosts, totalResources, totalRecordings, totalForumThreads, onlineCount },
      // Explicitly simulated — the old app mixed fake Math.random() network-monitoring
      // figures into the same payload as real user counts with no indication which was
      // which (plan §9 audit finding). Kept as mocked data (network-tools stays
      // simulated, plan §3), but now clearly separated and labeled.
      simulated: {
        networks: 12,
        devicesMonitored: 50 + Math.floor(Math.random() * 20),
        activeAlerts: Math.floor(Math.random() * 5),
        uptimePct: 99.9,
      },
    };
  }
}
