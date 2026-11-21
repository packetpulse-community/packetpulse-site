import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../../prisma/prisma.service";
import { paginate, prismaSkip } from "../../../../common/dto/pagination.util";
import { slugify } from "../../../../common/utils/slugify";
import { CreateForumThreadDto, ForumThreadListQueryDto, UpdateForumThreadDto } from "../dto/forums.dto";
import { SUPER_ADMIN_ROLE } from "../../../identity";
import { AdminActivityLogService } from "../../../admin";
import { NotificationsService } from "../../../notifications";
import { ForumGuidelinesService } from "./forum-guidelines.service";
import { ForumModerationService } from "./forum-moderation.service";
import { ForumReputationService } from "./forum-reputation.service";

function isModeratorRole(roles: string[]) {
  return roles.includes("admin") || roles.includes(SUPER_ADMIN_ROLE) || roles.includes("moderator");
}

const authorSelect = { id: true, firstName: true, lastName: true, avatarUrl: true } satisfies Prisma.UserSelect;

const threadSummaryInclude = {
  author: { select: authorSelect },
  category: true,
  _count: { select: { replies: true } },
} satisfies Prisma.ForumThreadInclude;

const threadDetailInclude = {
  author: { select: authorSelect },
  category: true,
  replies: {
    include: { author: { select: authorSelect }, _count: { select: { likes: true } } },
    orderBy: { createdAt: "asc" as const },
  },
} satisfies Prisma.ForumThreadInclude;

@Injectable()
export class ForumThreadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: AdminActivityLogService,
    private readonly guidelines: ForumGuidelinesService,
    private readonly moderation: ForumModerationService,
    private readonly reputation: ForumReputationService,
    private readonly notifications: NotificationsService,
  ) {}

  categories() {
    return this.prisma.category.findMany({ orderBy: { position: "asc" } });
  }

  async list(query: ForumThreadListQueryDto) {
    const skip = prismaSkip(query.page, query.limit);
    const where: Prisma.ForumThreadWhereInput = {
      categoryId: query.categoryId,
      mode: query.mode,
      removedAt: null,
      OR: query.search
        ? [
            { title: { contains: query.search, mode: "insensitive" } },
            { content: { contains: query.search, mode: "insensitive" } },
          ]
        : undefined,
    };

    const [data, total] = await Promise.all([
      this.prisma.forumThread.findMany({
        where,
        include: threadSummaryInclude,
        orderBy: [{ isPinned: "desc" }, { lastReplyAt: "desc" }],
        skip,
        take: query.limit,
      }),
      this.prisma.forumThread.count({ where }),
    ]);
    return paginate(data, query.page, query.limit, total);
  }

  async getById(id: string) {
    const thread = await this.prisma.forumThread.findUnique({ where: { id }, include: threadDetailInclude });
    if (!thread || thread.removedAt) throw new NotFoundException("Thread not found");
    await this.prisma.forumThread.update({ where: { id }, data: { viewCount: { increment: 1 } } });
    const rep = await this.reputation.forUsers([thread.authorId, ...thread.replies.map((r) => r.authorId)]);
    // The accepted answer is shown first (PRD-025); the rest keep their order. Removed text is hidden.
    const replies = thread.replies
      .map((r) => ({
        ...r,
        content: r.removedAt ? "" : r.content,
        removed: !!r.removedAt,
        removedReason: undefined,
        isAccepted: r.id === thread.acceptedReplyId,
        author: { ...r.author, reputation: rep.get(r.authorId) },
      }))
      .sort((a, b) => Number(b.isAccepted) - Number(a.isAccepted));
    return { ...thread, removedReason: undefined, author: { ...thread.author, reputation: rep.get(thread.authorId) }, replies };
  }

  async create(authorId: string, dto: CreateForumThreadDto) {
    await this.guidelines.assertAccepted(authorId);
    const category = await this.prisma.category.findUnique({ where: { id: dto.categoryId } });
    if (!category) throw new NotFoundException("Forum category not found");

    const slug = await this.uniqueSlug(dto.categoryId, dto.title);
    return this.prisma.forumThread.create({
      data: { categoryId: dto.categoryId, authorId, title: dto.title, content: dto.content, slug, mode: dto.mode },
      include: threadDetailInclude,
    });
  }

  async setLocked(id: string, userId: string, roles: string[], locked: boolean, reason?: string) {
    const thread = await this.prisma.forumThread.findUnique({ where: { id } });
    if (!thread) throw new NotFoundException("Thread not found");
    this.assertModeratorOrOwner(thread.authorId, userId, roles);
    this.assertReason(thread.authorId, userId, reason);
    const updated = await this.prisma.forumThread.update({ where: { id }, data: { isLocked: locked } });
    if (isModeratorRole(roles)) {
      await this.activityLog.log(userId, locked ? "forum_thread_locked" : "forum_thread_unlocked", "forum_thread", id, {
        title: thread.title,
      }, reason);
    }
    return updated;
  }

  async setPinned(id: string, userId: string, roles: string[], pinned: boolean, reason?: string) {
    const thread = await this.prisma.forumThread.findUnique({ where: { id } });
    if (!thread) throw new NotFoundException("Thread not found");
    this.assertModeratorOrOwner(thread.authorId, userId, roles);
    this.assertReason(thread.authorId, userId, reason);
    const updated = await this.prisma.forumThread.update({ where: { id }, data: { isPinned: pinned } });
    if (isModeratorRole(roles)) {
      await this.activityLog.log(userId, pinned ? "forum_thread_pinned" : "forum_thread_unpinned", "forum_thread", id, {
        title: thread.title,
      }, reason);
    }
    return updated;
  }

  async update(id: string, userId: string, roles: string[], dto: UpdateForumThreadDto) {
    const thread = await this.prisma.forumThread.findUnique({ where: { id } });
    if (!thread) throw new NotFoundException("Thread not found");
    this.assertModeratorOrOwner(thread.authorId, userId, roles);
    return this.prisma.forumThread.update({
      where: { id },
      data: { title: dto.title, content: dto.content },
      include: threadDetailInclude,
    });
  }

  /**
   * The author deletes their own thread (hard delete, reputation it earned is reversed). A
   * moderator removing someone else's thread must give a reason: the thread is hidden, the
   * author is told why and loses reputation (see ForumModerationService).
   */
  async delete(id: string, userId: string, roles: string[], reason?: string) {
    const thread = await this.prisma.forumThread.findUnique({ where: { id }, include: { replies: { select: { id: true } } } });
    if (!thread) throw new NotFoundException("Thread not found");
    this.assertModeratorOrOwner(thread.authorId, userId, roles);
    if (thread.authorId !== userId) {
      this.assertReason(thread.authorId, userId, reason);
      await this.moderation.removeThread(id, userId, reason!, "forum_thread_deleted");
      return { success: true };
    }
    await this.prisma.$transaction(async (tx) => {
      await this.reputation.reverseForReplies(tx, thread.replies.map((r) => r.id));
      await tx.forumThread.delete({ where: { id } });
    });
    return { success: true };
  }

  /** Accept one answer (PRD-025): only the asker or a moderator; a new choice replaces the old. */
  async accept(threadId: string, replyId: string, userId: string, roles: string[], reason?: string) {
    const thread = await this.prisma.forumThread.findUnique({ where: { id: threadId } });
    if (!thread || thread.removedAt) throw new NotFoundException("Thread not found");
    this.assertModeratorOrOwner(thread.authorId, userId, roles);
    this.assertReason(thread.authorId, userId, reason);
    const reply = await this.prisma.forumReply.findUnique({ where: { id: replyId } });
    if (!reply || reply.threadId !== threadId || reply.removedAt) throw new NotFoundException("Reply not found");
    if (thread.acceptedReplyId === replyId) return { acceptedReplyId: replyId };

    await this.prisma.$transaction(async (tx) => {
      if (thread.acceptedReplyId) await this.reputation.reverse(tx, { contentType: "reply", contentId: thread.acceptedReplyId, kind: "answer_accepted" });
      await tx.forumThread.update({ where: { id: threadId }, data: { acceptedReplyId: replyId, acceptedAt: new Date() } });
      await this.reputation.awardAccepted(tx, reply.authorId, thread.authorId, replyId, userId);
      if (thread.authorId !== userId) {
        await this.activityLog.log(userId, "forum_answer_accepted", "forum_thread", threadId, { replyId, askerId: thread.authorId }, reason, tx);
      }
    });
    if (reply.authorId !== thread.authorId) {
      await this.notifications.notify(
        reply.authorId,
        "forum_answer_accepted",
        { threadId, threadTitle: thread.title, replyId },
        `accepted:${replyId}`,
      );
    }
    return { acceptedReplyId: replyId };
  }

  async unaccept(threadId: string, userId: string, roles: string[], reason?: string) {
    const thread = await this.prisma.forumThread.findUnique({ where: { id: threadId } });
    if (!thread || thread.removedAt) throw new NotFoundException("Thread not found");
    this.assertModeratorOrOwner(thread.authorId, userId, roles);
    this.assertReason(thread.authorId, userId, reason);
    if (!thread.acceptedReplyId) return { acceptedReplyId: null };
    await this.prisma.$transaction(async (tx) => {
      await this.reputation.reverse(tx, { contentType: "reply", contentId: thread.acceptedReplyId!, kind: "answer_accepted" });
      await tx.forumThread.update({ where: { id: threadId }, data: { acceptedReplyId: null, acceptedAt: null } });
      if (thread.authorId !== userId) {
        await this.activityLog.log(userId, "forum_answer_accepted", "forum_thread", threadId, { replyId: thread.acceptedReplyId, askerId: thread.authorId, undone: true }, reason, tx);
      }
    });
    return { acceptedReplyId: null };
  }

  /** A moderator acting on someone else's content must say why; the reason is audited. */
  assertReason(ownerId: string, userId: string, reason?: string) {
    if (ownerId !== userId && !reason?.trim()) {
      throw new BadRequestException("A reason is required for this moderator action.");
    }
  }

  assertModeratorOrOwner(ownerId: string, userId: string, roles: string[]) {
    const isOwner = ownerId === userId;
    const isModerator = roles.includes("admin") || roles.includes(SUPER_ADMIN_ROLE) || roles.includes("moderator");
    if (!isOwner && !isModerator) throw new ForbiddenException("Not permitted");
  }

  private async uniqueSlug(categoryId: string, title: string): Promise<string> {
    const base = slugify(title);
    let candidate = base;
    let suffix = 1;
    while (
      await this.prisma.forumThread.findUnique({ where: { categoryId_slug: { categoryId, slug: candidate } } })
    ) {
      candidate = `${base}-${suffix++}`;
    }
    return candidate;
  }
}
