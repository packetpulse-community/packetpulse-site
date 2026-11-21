import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service";
import { CreateForumReplyDto } from "../dto/forums.dto";
import { ForumThreadsService } from "./forum-threads.service";
import { NotificationsService } from "../../../notifications";
import { ForumGuidelinesService } from "./forum-guidelines.service";
import { ForumModerationService } from "./forum-moderation.service";
import { ForumReputationService } from "./forum-reputation.service";

@Injectable()
export class ForumRepliesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly threads: ForumThreadsService,
    private readonly notifications: NotificationsService,
    private readonly guidelines: ForumGuidelinesService,
    private readonly moderation: ForumModerationService,
    private readonly reputation: ForumReputationService,
  ) {}

  async add(threadId: string, authorId: string, dto: CreateForumReplyDto) {
    await this.guidelines.assertAccepted(authorId);
    const thread = await this.prisma.forumThread.findUnique({ where: { id: threadId } });
    if (!thread || thread.removedAt) throw new NotFoundException("Thread not found");
    if (thread.isLocked) throw new NotFoundException("Thread is locked");

    const [reply] = await this.prisma.$transaction([
      this.prisma.forumReply.create({
        data: { threadId, authorId, content: dto.content, parentReplyId: dto.parentReplyId },
        include: { author: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
      }),
      this.prisma.forumThread.update({
        where: { id: threadId },
        data: { replyCount: { increment: 1 }, lastReplyAt: new Date() },
      }),
    ]);

    if (thread.authorId !== authorId) {
      await this.notifications.notify(thread.authorId, "forum_reply", {
        threadId,
        threadTitle: thread.title,
        replyId: reply.id,
        fromUserId: authorId,
      });
    }

    return reply;
  }

  /** Author: hard delete. Moderator on someone else's reply: soft removal with a required reason. */
  async remove(threadId: string, replyId: string, userId: string, roles: string[], reason?: string) {
    const reply = await this.prisma.forumReply.findUnique({ where: { id: replyId } });
    if (!reply || reply.threadId !== threadId) throw new NotFoundException("Reply not found");
    this.threads.assertModeratorOrOwner(reply.authorId, userId, roles);
    if (reply.authorId !== userId) {
      this.threads.assertReason(reply.authorId, userId, reason);
      await this.moderation.removeReply(replyId, userId, reason!, "forum_reply_deleted");
      return;
    }
    await this.prisma.$transaction(async (tx) => {
      await this.reputation.reverseForReplies(tx, [replyId]);
      await tx.forumReply.delete({ where: { id: replyId } });
      await tx.forumThread.update({ where: { id: threadId }, data: { replyCount: { decrement: 1 } } });
    });
  }

  // A helpful vote (PRD-025). Voting for your own reply is refused; the reputation side has its own caps.
  async toggleLike(replyId: string, userId: string) {
    const reply = await this.prisma.forumReply.findUnique({ where: { id: replyId }, select: { id: true, authorId: true, removedAt: true } });
    if (!reply || reply.removedAt) throw new NotFoundException("Reply not found");
    if (reply.authorId === userId) throw new BadRequestException("You cannot vote for your own reply.");

    const existing = await this.prisma.forumReplyLike.findUnique({
      where: { replyId_userId: { replyId, userId } },
    });
    if (existing) {
      await this.prisma.$transaction(async (tx) => {
        await tx.forumReplyLike.delete({ where: { replyId_userId: { replyId, userId } } });
        await this.reputation.reverse(tx, { contentType: "reply", contentId: replyId, kind: "helpful_vote", actorId: userId });
      });
      return { liked: false };
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.forumReplyLike.create({ data: { replyId, userId } });
      await this.reputation.awardHelpful(tx, reply.authorId, userId, replyId);
    });
    return { liked: true };
  }
}
