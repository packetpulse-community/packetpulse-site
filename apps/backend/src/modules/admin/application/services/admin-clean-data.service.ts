import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../../prisma/prisma.service";
import { AdminActivityLogService } from "./admin-activity-log.service";
import { CleanDataDto } from "../dto/admin.dto";

type DataType = CleanDataDto["dataType"];

// Real implementation — the old app's admin clean-data endpoints only had comments
// where the deletion logic used to be ("// Remove certificates count", etc.) and
// returned a fake success response without touching anything (plan §3 known bug).
@Injectable()
export class AdminCleanDataService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: AdminActivityLogService,
  ) {}

  // The deletions and the audit entry commit together: a clean-data run that cannot be
  // recorded does not happen (finding S-6: it used to delete certificates and posts silently).
  async cleanUser(userId: string, dataType: DataType, actorId: string, reason: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException("User not found");
    return this.prisma.$transaction(async (tx) => {
      const counts = await this.clean(tx, userId, dataType);
      await this.activityLog.log(
        actorId,
        "user_data_cleaned",
        "user",
        userId,
        { email: user.email, dataType, deleted: counts },
        reason,
        tx,
      );
      return counts;
    });
  }

  async cleanBulk(userIds: string[], dataType: DataType, actorId: string, reason: string) {
    return this.prisma.$transaction(async (tx) => {
      const total = { quizAttempts: 0, certificates: 0, forumPosts: 0 };
      for (const id of userIds) {
        const r = await this.clean(tx, id, dataType);
        total.quizAttempts += r.quizAttempts;
        total.certificates += r.certificates;
        total.forumPosts += r.forumPosts;
      }
      await this.activityLog.log(
        actorId,
        "users_data_bulk_cleaned",
        "user",
        undefined,
        { userIds, dataType, deleted: total },
        reason,
        tx,
      );
      return total;
    });
  }

  private async clean(tx: Prisma.TransactionClient, userId: string, dataType: DataType) {
    let quizAttempts = 0;
    let certificates = 0;
    let forumPosts = 0;

    if (dataType === "quiz_attempts" || dataType === "all") {
      quizAttempts = (await tx.quizAttempt.deleteMany({ where: { userId } })).count;
    }
    if (dataType === "certificates" || dataType === "all") {
      certificates = (await tx.certificate.deleteMany({ where: { userId } })).count;
    }
    if (dataType === "forum_posts" || dataType === "all") {
      const replies = await tx.forumReply.deleteMany({ where: { authorId: userId } });
      const threads = await tx.forumThread.deleteMany({ where: { authorId: userId } });
      forumPosts = replies.count + threads.count;
    }

    return { quizAttempts, certificates, forumPosts };
  }
}
