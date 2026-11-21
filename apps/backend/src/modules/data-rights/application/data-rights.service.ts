import { Injectable } from "@nestjs/common";
import { ERASURE_GRACE_DAYS, EXPORT_AVAILABLE_DAYS, DataRightsOverview } from "@packetpulse/types";
import { PrismaService } from "../../../prisma/prisma.service";
import { paginate, prismaSkip } from "../../../common/dto/pagination.util";
import { FeatureFlagsService } from "../../feature-flags/feature-flags.service";
import { AccountErasureService } from "./account-erasure.service";
import { DataExportService } from "./data-export.service";
import { toView } from "./data-request.view";
import type { AdminDataRequestListQueryDto } from "./data-rights.dto";

@Injectable()
export class DataRightsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly exports: DataExportService,
    private readonly erasure: AccountErasureService,
    private readonly flags: FeatureFlagsService,
  ) {}

  async overview(userId: string): Promise<DataRightsOverview> {
    const [exp, era, exportEnabled] = await Promise.all([
      this.exports.latest(userId),
      this.erasure.latest(userId),
      this.flags.isEnabled("data_rights.export"),
    ]);
    return { export: exp, erasure: era, exportEnabled, graceDays: ERASURE_GRACE_DAYS, exportAvailableDays: EXPORT_AVAILABLE_DAYS };
  }

  // Staff view (read-only): who has a request open, where it stands and what was recorded in the
  // audit log. It never touches the export file or its contents, and offers no way to open them.
  async adminList(query: AdminDataRequestListQueryDto) {
    const where = {
      ...(query.kind ? { kind: query.kind } : {}),
      ...(query.scope === "open" ? { activeSlot: { not: null } } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.dataRequest.findMany({
        where,
        orderBy: { requestedAt: "desc" },
        skip: prismaSkip(query.page, query.limit),
        take: query.limit,
        include: { user: { select: { id: true, firstName: true, lastName: true, email: true, erasedAt: true } } },
      }),
      this.prisma.dataRequest.count({ where }),
    ]);
    const requestIds = rows.map((r) => r.id);
    const userIds = [...new Set(rows.map((r) => r.userId))];
    const entries = rows.length
      ? await this.prisma.adminActivityLog.findMany({
          where: {
            OR: [
              { targetType: "data_request", targetId: { in: requestIds } },
              { targetType: "user", targetId: { in: userIds }, action: { in: ["account_deletion_requested", "account_deletion_cancelled", "account_erased"] } },
            ],
          },
          orderBy: { createdAt: "asc" },
          select: { action: true, createdAt: true, targetType: true, targetId: true, details: true },
        })
      : [];
    const data = rows.map((r) => ({
      ...toView(r),
      user: { id: r.user.id, firstName: r.user.firstName, lastName: r.user.lastName, email: r.user.email, erased: r.user.erasedAt !== null },
      audit: entries
        .filter((e) =>
          e.targetType === "data_request"
            ? e.targetId === r.id
            : e.targetId === r.userId && (e.details as { requestId?: string } | null)?.requestId === r.id,
        )
        .map((e) => ({ action: e.action, at: e.createdAt.toISOString() })),
    }));
    return paginate(data, query.page, query.limit, total);
  }
}
