import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../../prisma/prisma.service";
import { paginate, prismaSkip } from "../../../../common/dto/pagination.util";
import { slugify } from "../../../../common/utils/slugify";
import { CreateForumThreadDto, ForumThreadListQueryDto } from "../dto/forums.dto";
import { SUPER_ADMIN_ROLE } from "../../../identity";

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
  constructor(private readonly prisma: PrismaService) {}

  categories() {
    return this.prisma.forumCategory.findMany({ orderBy: { position: "asc" } });
  }

  async list(query: ForumThreadListQueryDto) {
    const skip = prismaSkip(query.page, query.limit);
    const where: Prisma.ForumThreadWhereInput = {
      categoryId: query.categoryId,
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
    if (!thread) throw new NotFoundException("Thread not found");
    await this.prisma.forumThread.update({ where: { id }, data: { viewCount: { increment: 1 } } });
    return thread;
  }

  async create(authorId: string, dto: CreateForumThreadDto) {
    const category = await this.prisma.forumCategory.findUnique({ where: { id: dto.categoryId } });
    if (!category) throw new NotFoundException("Forum category not found");

    const slug = await this.uniqueSlug(dto.categoryId, dto.title);
    return this.prisma.forumThread.create({
      data: { categoryId: dto.categoryId, authorId, title: dto.title, content: dto.content, slug },
      include: threadDetailInclude,
    });
  }

  async setLocked(id: string, userId: string, roles: string[], locked: boolean) {
    const thread = await this.prisma.forumThread.findUnique({ where: { id } });
    if (!thread) throw new NotFoundException("Thread not found");
    this.assertModeratorOrOwner(thread.authorId, userId, roles);
    return this.prisma.forumThread.update({ where: { id }, data: { isLocked: locked } });
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
