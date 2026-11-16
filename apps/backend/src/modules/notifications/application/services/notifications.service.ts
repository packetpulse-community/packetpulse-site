import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { NotificationType } from "@prisma/client";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../../../prisma/prisma.service";
import { FANOUT_QUEUE, fanoutJobOptions, idempotencyJobId } from "../../infrastructure/queue/queue-config";

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
    @InjectQueue(FANOUT_QUEUE) private readonly fanoutQueue: Queue<FanoutJobData>,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  // `idempotencyKey` (optional) identifies the event (e.g. a reply id): calling notify
  // twice with the same key for the same user and type creates one notification.
  // Without it every call is a distinct notification.
  notify(userId: string, type: NotificationType, payload: Record<string, unknown>, idempotencyKey?: string) {
    const base = Number(this.config.get("QUEUE_BACKOFF_MS"));
    const opts = fanoutJobOptions(Number.isFinite(base) && base > 0 ? base : undefined);
    if (idempotencyKey) opts.jobId = idempotencyJobId("fanout", userId, type, idempotencyKey);
    return this.fanoutQueue.add("fanout", { userId, type, payload }, opts);
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
