import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { NotificationType } from "@prisma/client";
import { PrismaService } from "../../../../prisma/prisma.service";

export interface FanoutJobData {
  userId: string;
  type: NotificationType;
  payload: Record<string, unknown>;
}

// Public API other modules depend on (forums, blogs, admin, quizzes) — enqueues onto
// the `fanout` queue, which writes the notifications row and pushes the real-time
// event, decoupling the caller from both the DB write and the socket emit (plan §5).
@Injectable()
export class NotificationsService {
  constructor(
    @InjectQueue("fanout") private readonly fanoutQueue: Queue<FanoutJobData>,
    private readonly prisma: PrismaService,
  ) {}

  notify(userId: string, type: NotificationType, payload: Record<string, unknown>) {
    return this.fanoutQueue.add("fanout", { userId, type, payload });
  }

  async listMine(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  async markRead(id: string, userId: string) {
    await this.prisma.notification.updateMany({ where: { id, userId }, data: { readAt: new Date() } });
  }

  async unreadCount(userId: string) {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }
}
