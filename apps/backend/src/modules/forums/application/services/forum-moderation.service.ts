import { Injectable, NotFoundException } from "@nestjs/common";
import { AdminActivityAction } from "@prisma/client";
import { PrismaService } from "../../../../prisma/prisma.service";
import { AdminActivityLogService } from "../../../admin";
import { NotificationsService } from "../../../notifications";
import { ForumReputationService } from "./forum-reputation.service";

// The one place a moderator removes a thread or reply: soft removal (the row stays, the text is
// hidden), the reputation it earned is reversed and a removal penalty applied, the audit entry
// carries the reason, and the author is told the reason through the notification dispatcher.
@Injectable()
export class ForumModerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AdminActivityLogService,
    private readonly reputation: ForumReputationService,
    private readonly notifications: NotificationsService,
  ) {}

  async removeThread(threadId: string, actorId: string, reason: string, action: AdminActivityAction, extra: object = {}) {
    const thread = await this.prisma.forumThread.findUnique({ where: { id: threadId }, include: { replies: { select: { id: true } } } });
    if (!thread) throw new NotFoundException("Thread not found");
    if (thread.removedAt) return { alreadyRemoved: true };
    await this.prisma.$transaction(async (tx) => {
      await tx.forumThread.update({
        where: { id: threadId },
        data: { removedAt: new Date(), removedReason: reason, acceptedReplyId: null, acceptedAt: null },
      });
      await this.reputation.penalise(tx, thread.authorId, "thread", threadId, actorId, thread.replies.map((r) => r.id));
      await this.audit.log(actorId, action, "forum_thread", threadId, { title: thread.title, authorId: thread.authorId, ...extra }, reason, tx);
    });
    await this.tell(thread.authorId, "thread", threadId, thread.title, reason, threadId);
    return { alreadyRemoved: false };
  }

  async removeReply(replyId: string, actorId: string, reason: string, action: AdminActivityAction, extra: object = {}) {
    const reply = await this.prisma.forumReply.findUnique({ where: { id: replyId }, include: { thread: { select: { id: true, title: true } } } });
    if (!reply) throw new NotFoundException("Reply not found");
    if (reply.removedAt) return { alreadyRemoved: true };
    await this.prisma.$transaction(async (tx) => {
      await tx.forumReply.update({ where: { id: replyId }, data: { removedAt: new Date(), removedReason: reason } });
      await tx.forumThread.updateMany({ where: { acceptedReplyId: replyId }, data: { acceptedReplyId: null, acceptedAt: null } });
      await this.reputation.penalise(tx, reply.authorId, "reply", replyId, actorId);
      await this.audit.log(actorId, action, "forum_reply", replyId, { threadId: reply.threadId, authorId: reply.authorId, ...extra }, reason, tx);
    });
    await this.tell(reply.authorId, "reply", replyId, reply.thread.title, reason, reply.threadId);
    return { alreadyRemoved: false };
  }

  private tell(authorId: string, contentType: string, contentId: string, title: string, reason: string, threadId: string) {
    return this.notifications.notify(
      authorId,
      "forum_post_removed",
      { contentType, threadId, threadTitle: title, reason },
      `removed:${contentType}:${contentId}`,
    );
  }
}
