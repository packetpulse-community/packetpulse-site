import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service";
import { CleanDataDto } from "../dto/admin.dto";

type DataType = CleanDataDto["dataType"];

// Real implementation — the old app's admin clean-data endpoints only had comments
// where the deletion logic used to be ("// Remove certificates count", etc.) and
// returned a fake success response without touching anything (plan §3 known bug).
@Injectable()
export class AdminCleanDataService {
  constructor(private readonly prisma: PrismaService) {}

  async cleanUser(userId: string, dataType: DataType) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException("User not found");
    return this.clean(userId, dataType);
  }

  async cleanBulk(userIds: string[], dataType: DataType) {
    const results = await Promise.all(userIds.map((id) => this.clean(id, dataType)));
    return results.reduce(
      (acc, r) => ({
        quizAttempts: acc.quizAttempts + r.quizAttempts,
        certificates: acc.certificates + r.certificates,
        forumPosts: acc.forumPosts + r.forumPosts,
      }),
      { quizAttempts: 0, certificates: 0, forumPosts: 0 },
    );
  }

  private async clean(userId: string, dataType: DataType) {
    let quizAttempts = 0;
    let certificates = 0;
    let forumPosts = 0;

    if (dataType === "quiz_attempts" || dataType === "all") {
      const r = await this.prisma.quizAttempt.deleteMany({ where: { userId } });
      quizAttempts = r.count;
    }
    if (dataType === "certificates" || dataType === "all") {
      const r = await this.prisma.certificate.deleteMany({ where: { userId } });
      certificates = r.count;
    }
    if (dataType === "forum_posts" || dataType === "all") {
      const [replies, threads] = await Promise.all([
        this.prisma.forumReply.deleteMany({ where: { authorId: userId } }),
        this.prisma.forumThread.deleteMany({ where: { authorId: userId } }),
      ]);
      forumPosts = replies.count + threads.count;
    }

    return { quizAttempts, certificates, forumPosts };
  }
}
