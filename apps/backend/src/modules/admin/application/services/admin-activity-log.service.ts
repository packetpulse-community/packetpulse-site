import { Injectable } from "@nestjs/common";
import { AdminActivityAction } from "@prisma/client";
import { PrismaService } from "../../../../prisma/prisma.service";
import { paginate, prismaSkip } from "../../../../common/dto/pagination.util";
import type { AdminActivityListQueryDto } from "../dto/admin.dto";

// Real audit trail for admin actions — the old app's "Recent Activity" dashboard
// table called a route that was never registered server-side (permanently empty).
// Every admin moderation/user-management mutation writes one row here.
@Injectable()
export class AdminActivityLogService {
  constructor(private readonly prisma: PrismaService) {}

  log(actorId: string | null, action: AdminActivityAction, targetType: string, targetId?: string, details?: object) {
    return this.prisma.adminActivityLog.create({
      data: { actorId, action, targetType, targetId, details: details as object | undefined },
    });
  }

  async list(query: AdminActivityListQueryDto) {
    const skip = prismaSkip(query.page, query.limit);
    const [data, total] = await Promise.all([
      this.prisma.adminActivityLog.findMany({
        include: { actor: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: { createdAt: "desc" },
        skip,
        take: query.limit,
      }),
      this.prisma.adminActivityLog.count(),
    ]);
    return paginate(data, query.page, query.limit, total);
  }

  async distribution() {
    const groups = await this.prisma.adminActivityLog.groupBy({
      by: ["action"],
      _count: { _all: true },
    });
    return groups.map((g) => ({ action: g.action, count: g._count._all }));
  }
}
