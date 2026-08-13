import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, ResourceCategory, ResourceType } from "@prisma/client";
import { PrismaService } from "../../../../prisma/prisma.service";
import { paginate, prismaSkip } from "../../../../common/dto/pagination.util";
import { CreateResourceDto, UpdateResourceDto, ResourceListQueryDto } from "../dto/resources.dto";
import { SUPER_ADMIN_ROLE } from "../../../identity";

const summaryInclude = {
  user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
  tags: true,
  _count: { select: { likes: true } },
} satisfies Prisma.ResourceInclude;

@Injectable()
export class ResourcesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ResourceListQueryDto, isAdmin: boolean) {
    const skip = prismaSkip(query.page, query.limit);
    // Public/non-admin listing only ever surfaces approved resources — moderation
    // queue visibility is an admin-only concern (plan §2/§4, built in Phase 4).
    const where: Prisma.ResourceWhereInput = {
      isApproved: isAdmin ? undefined : true,
      category: query.category as ResourceCategory | undefined,
      resourceType: query.resourceType as ResourceType | undefined,
      tags: query.tag ? { some: { tag: query.tag } } : undefined,
      OR: query.search
        ? [
            { title: { contains: query.search, mode: "insensitive" } },
            { description: { contains: query.search, mode: "insensitive" } },
          ]
        : undefined,
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.resource.findMany({
        where,
        include: summaryInclude,
        orderBy: { createdAt: "desc" },
        skip,
        take: query.limit,
      }),
      this.prisma.resource.count({ where }),
    ]);
    return paginate(data, query.page, query.limit, total);
  }

  async getById(id: string, isAdmin: boolean) {
    const resource = await this.prisma.resource.findUnique({ where: { id }, include: summaryInclude });
    if (!resource || (!resource.isApproved && !isAdmin)) throw new NotFoundException("Resource not found");
    await this.prisma.resource.update({ where: { id }, data: { views: { increment: 1 } } });
    return resource;
  }

  async create(userId: string, roles: string[], dto: CreateResourceDto) {
    const isAdmin = roles.includes("admin") || roles.includes(SUPER_ADMIN_ROLE);
    return this.prisma.resource.create({
      data: {
        title: dto.title,
        description: dto.description,
        resourceType: dto.resourceType as ResourceType,
        category: dto.category as ResourceCategory,
        fileUrl: dto.fileUrl,
        externalLink: dto.externalLink,
        thumbnailUrl: dto.thumbnailUrl,
        downloadable: dto.downloadable,
        premium: dto.premium,
        userId,
        // Admin-created resources are auto-approved; member submissions enter the
        // moderation queue (admin module, Phase 4).
        isApproved: isAdmin,
        tags: { create: dto.tags.map((tag) => ({ tag })) },
      },
      include: summaryInclude,
    });
  }

  async update(id: string, userId: string, roles: string[], dto: UpdateResourceDto) {
    const existing = await this.prisma.resource.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Resource not found");
    this.assertOwnerOrAdmin(existing.userId, userId, roles);

    if (dto.tags) {
      await this.prisma.resourceTag.deleteMany({ where: { resourceId: id } });
    }

    return this.prisma.resource.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        resourceType: dto.resourceType as ResourceType | undefined,
        category: dto.category as ResourceCategory | undefined,
        fileUrl: dto.fileUrl,
        externalLink: dto.externalLink,
        thumbnailUrl: dto.thumbnailUrl,
        downloadable: dto.downloadable,
        premium: dto.premium,
        tags: dto.tags ? { create: dto.tags.map((tag) => ({ tag })) } : undefined,
      },
      include: summaryInclude,
    });
  }

  async delete(id: string, userId: string, roles: string[]) {
    const existing = await this.prisma.resource.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Resource not found");
    this.assertOwnerOrAdmin(existing.userId, userId, roles);
    await this.prisma.resource.delete({ where: { id } });
  }

  async toggleLike(id: string, userId: string) {
    const resource = await this.prisma.resource.findUnique({ where: { id }, select: { id: true } });
    if (!resource) throw new NotFoundException("Resource not found");

    const existing = await this.prisma.resourceLike.findUnique({
      where: { resourceId_userId: { resourceId: id, userId } },
    });
    if (existing) {
      await this.prisma.resourceLike.delete({ where: { resourceId_userId: { resourceId: id, userId } } });
      return { liked: false };
    }
    await this.prisma.resourceLike.create({ data: { resourceId: id, userId } });
    return { liked: true };
  }

  private assertOwnerOrAdmin(ownerId: string, userId: string, roles: string[]) {
    const isOwner = ownerId === userId;
    const isAdmin = roles.includes("admin") || roles.includes(SUPER_ADMIN_ROLE);
    if (!isOwner && !isAdmin) throw new ForbiddenException("You do not own this resource");
  }
}
