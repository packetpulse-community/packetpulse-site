import { BadRequestException, ConflictException, HttpException, HttpStatus, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  CreateForumReportDto,
  FORUM_REPORTS_PER_DAY,
  FORUM_URGENT_REASONS,
  ForumReportListQuery,
} from "@packetpulse/types";
import { PrismaService } from "../../../../prisma/prisma.service";
import { paginate, prismaSkip } from "../../../../common/dto/pagination.util";
import { AdminActivityLogService } from "../../../admin";
import { ForumModerationService } from "./forum-moderation.service";

const HOUR = 3600_000;

// Reports (PRD-025, PRD-028, API-023): a member reports a thread or reply with a reason; one
// report per reporter per post; a daily cap per reporter. Moderators dismiss or remove, each with
// a reason, and each decision is audited. Targets: 4 hours when urgent, 24 hours otherwise.
@Injectable()
export class ForumReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AdminActivityLogService,
    private readonly moderation: ForumModerationService,
  ) {}

  async create(reporterId: string, target: { threadId: string } | { replyId: string }, dto: CreateForumReportDto) {
    let authorId: string;
    if ("threadId" in target) {
      const t = await this.prisma.forumThread.findUnique({ where: { id: target.threadId }, select: { authorId: true, removedAt: true } });
      if (!t || t.removedAt) throw new NotFoundException("Thread not found");
      authorId = t.authorId;
    } else {
      const r = await this.prisma.forumReply.findUnique({ where: { id: target.replyId }, select: { authorId: true, removedAt: true } });
      if (!r || r.removedAt) throw new NotFoundException("Reply not found");
      authorId = r.authorId;
    }
    if (authorId === reporterId) throw new BadRequestException("You cannot report your own post. Edit or delete it instead.");

    const recent = await this.prisma.forumReport.count({
      where: { reporterId, createdAt: { gte: new Date(Date.now() - 24 * HOUR) } },
    });
    if (recent >= FORUM_REPORTS_PER_DAY) {
      throw new HttpException(
        `You can send ${FORUM_REPORTS_PER_DAY} reports a day. Please try again tomorrow, or contact the moderators.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    try {
      const report = await this.prisma.forumReport.create({
        data: {
          reporterId,
          ...target,
          reason: dto.reason,
          details: dto.details || null,
          urgent: FORUM_URGENT_REASONS.includes(dto.reason),
        },
      });
      return { id: report.id, status: report.status, urgent: report.urgent };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException("You already reported this post. The moderators will review it.");
      }
      throw err;
    }
  }

  async list(query: ForumReportListQuery) {
    const where: Prisma.ForumReportWhereInput = { status: query.status };
    const [rows, total] = await Promise.all([
      this.prisma.forumReport.findMany({
        where,
        include: {
          reporter: { select: { id: true, firstName: true, lastName: true } },
          resolvedBy: { select: { id: true, firstName: true, lastName: true } },
          thread: { select: { id: true, title: true, content: true, authorId: true, removedAt: true } },
          reply: { select: { id: true, content: true, authorId: true, removedAt: true, threadId: true } },
        },
        orderBy: query.status === "open" ? [{ urgent: "desc" }, { createdAt: "asc" }] : [{ resolvedAt: "desc" }],
        skip: prismaSkip(query.page, query.limit),
        take: query.limit,
      }),
      this.prisma.forumReport.count({ where }),
    ]);
    const now = Date.now();
    const data = rows.map((r) => {
      const dueAt = new Date(r.createdAt.getTime() + (r.urgent ? 4 : 24) * HOUR);
      return {
        id: r.id,
        status: r.status,
        reason: r.reason,
        details: r.details,
        urgent: r.urgent,
        createdAt: r.createdAt,
        acknowledgeBy: dueAt,
        overdue: r.status === "open" && dueAt.getTime() < now,
        reporter: r.reporter,
        kind: r.thread ? ("thread" as const) : ("reply" as const),
        threadId: r.thread?.id ?? r.reply?.threadId ?? null,
        title: r.thread?.title ?? null,
        excerpt: (r.thread?.content ?? r.reply?.content ?? "").slice(0, 240),
        contentRemoved: !!(r.thread?.removedAt ?? r.reply?.removedAt),
        resolution: r.resolution,
        resolvedAt: r.resolvedAt,
        resolvedBy: r.resolvedBy,
      };
    });
    return paginate(data, query.page, query.limit, total);
  }

  private async openReport(id: string) {
    const report = await this.prisma.forumReport.findUnique({ where: { id } });
    if (!report) throw new NotFoundException("Report not found");
    if (report.status !== "open") throw new ConflictException("This report was already decided.");
    return report;
  }

  async dismiss(id: string, actorId: string, reason: string) {
    const report = await this.openReport(id);
    await this.prisma.$transaction(async (tx) => {
      const res = await tx.forumReport.updateMany({
        where: { id, status: "open" },
        data: { status: "dismissed", resolvedById: actorId, resolvedAt: new Date(), resolution: reason },
      });
      if (res.count === 0) throw new ConflictException("This report was already decided.");
      await this.audit.log(
        actorId,
        "forum_report_dismissed",
        "forum_report",
        id,
        { threadId: report.threadId, replyId: report.replyId, reportReason: report.reason },
        reason,
        tx,
      );
    });
    return { id, status: "dismissed" as const };
  }

  /** Removes the reported post and closes every open report about it. */
  async remove(id: string, actorId: string, reason: string) {
    const report = await this.openReport(id);
    const extra = { reportId: id, reportReason: report.reason };
    if (report.threadId) await this.moderation.removeThread(report.threadId, actorId, reason, "forum_report_removed", extra);
    else if (report.replyId) await this.moderation.removeReply(report.replyId, actorId, reason, "forum_report_removed", extra);
    await this.prisma.forumReport.updateMany({
      where: {
        status: "open",
        OR: [
          ...(report.threadId ? [{ threadId: report.threadId }] : []),
          ...(report.replyId ? [{ replyId: report.replyId }] : []),
        ],
      },
      data: { status: "removed", resolvedById: actorId, resolvedAt: new Date(), resolution: reason },
    });
    return { id, status: "removed" as const };
  }
}
