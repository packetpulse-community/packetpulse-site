import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service";
import { CreateForumReplyDto } from "../dto/forums.dto";
import { ForumThreadsService } from "./forum-threads.service";

@Injectable()
export class ForumRepliesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly threads: ForumThreadsService,
  ) {}

  async add(threadId: string, authorId: string, dto: CreateForumReplyDto) {
    const thread = await this.prisma.forumThread.findUnique({ where: { id: threadId } });
    if (!thread) throw new NotFoundException("Thread not found");
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
    return reply;
  }

  async remove(threadId: string, replyId: string, userId: string, roles: string[]) {
    const reply = await this.prisma.forumReply.findUnique({ where: { id: replyId } });
    if (!reply || reply.threadId !== threadId) throw new NotFoundException("Reply not found");
    this.threads.assertModeratorOrOwner(reply.authorId, userId, roles);

    await this.prisma.$transaction([
      this.prisma.forumReply.delete({ where: { id: replyId } }),
      this.prisma.forumThread.update({ where: { id: threadId }, data: { replyCount: { decrement: 1 } } }),
    ]);
  }

  async toggleLike(replyId: string, userId: string) {
    const reply = await this.prisma.forumReply.findUnique({ where: { id: replyId }, select: { id: true } });
    if (!reply) throw new NotFoundException("Reply not found");

    const existing = await this.prisma.forumReplyLike.findUnique({
      where: { replyId_userId: { replyId, userId } },
    });
    if (existing) {
      await this.prisma.forumReplyLike.delete({ where: { replyId_userId: { replyId, userId } } });
      return { liked: false };
    }
    await this.prisma.forumReplyLike.create({ data: { replyId, userId } });
    return { liked: true };
  }
}
