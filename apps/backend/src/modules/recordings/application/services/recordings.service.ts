import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, RecordingCategory } from "@prisma/client";
import { PrismaService } from "../../../../prisma/prisma.service";
import { paginate, prismaSkip } from "../../../../common/dto/pagination.util";
import { CreateRecordingDto, UpdateRecordingDto, RecordingListQueryDto } from "../dto/recordings.dto";
import { SUPER_ADMIN_ROLE } from "../../../identity";

const summaryInclude = {
  instructor: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
  tags: true,
  _count: { select: { likes: true, participants: true } },
} satisfies Prisma.RecordingInclude;

@Injectable()
export class RecordingsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: RecordingListQueryDto, isAdmin: boolean) {
    const skip = prismaSkip(query.page, query.limit);
    const where: Prisma.RecordingWhereInput = {
      isApproved: isAdmin ? undefined : true,
      category: query.category as RecordingCategory | undefined,
      tags: query.tag ? { some: { tag: query.tag } } : undefined,
      OR: query.search
        ? [
            { title: { contains: query.search, mode: "insensitive" } },
            { description: { contains: query.search, mode: "insensitive" } },
          ]
        : undefined,
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.recording.findMany({
        where,
        include: summaryInclude,
        orderBy: { recordedAt: "desc" },
        skip,
        take: query.limit,
      }),
      this.prisma.recording.count({ where }),
    ]);
    return paginate(data, query.page, query.limit, total);
  }

  async getById(id: string, isAdmin: boolean) {
    const recording = await this.prisma.recording.findUnique({ where: { id }, include: summaryInclude });
    if (!recording || (!recording.isApproved && !isAdmin)) throw new NotFoundException("Recording not found");
    await this.prisma.recording.update({ where: { id }, data: { views: { increment: 1 } } });
    return recording;
  }

  async create(instructorId: string, roles: string[], dto: CreateRecordingDto) {
    const isAdmin = roles.includes("admin") || roles.includes(SUPER_ADMIN_ROLE);
    return this.prisma.recording.create({
      data: {
        title: dto.title,
        description: dto.description,
        recordingUrl: dto.recordingUrl,
        thumbnailUrl: dto.thumbnailUrl,
        durationSeconds: dto.durationSeconds,
        category: dto.category as RecordingCategory,
        premium: dto.premium,
        instructorId,
        isApproved: isAdmin,
        tags: { create: dto.tags.map((tag) => ({ tag })) },
      },
      include: summaryInclude,
    });
  }

  async update(id: string, userId: string, roles: string[], dto: UpdateRecordingDto) {
    const existing = await this.prisma.recording.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Recording not found");
    this.assertOwnerOrAdmin(existing.instructorId, userId, roles);

    if (dto.tags) {
      await this.prisma.recordingTag.deleteMany({ where: { recordingId: id } });
    }

    return this.prisma.recording.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        recordingUrl: dto.recordingUrl,
        thumbnailUrl: dto.thumbnailUrl,
        durationSeconds: dto.durationSeconds,
        category: dto.category as RecordingCategory | undefined,
        premium: dto.premium,
        tags: dto.tags ? { create: dto.tags.map((tag) => ({ tag })) } : undefined,
      },
      include: summaryInclude,
    });
  }

  async delete(id: string, userId: string, roles: string[]) {
    const existing = await this.prisma.recording.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Recording not found");
    this.assertOwnerOrAdmin(existing.instructorId, userId, roles);
    await this.prisma.recording.delete({ where: { id } });
  }

  async toggleLike(id: string, userId: string) {
    const recording = await this.prisma.recording.findUnique({ where: { id }, select: { id: true } });
    if (!recording) throw new NotFoundException("Recording not found");

    const existing = await this.prisma.recordingLike.findUnique({
      where: { recordingId_userId: { recordingId: id, userId } },
    });
    if (existing) {
      await this.prisma.recordingLike.delete({ where: { recordingId_userId: { recordingId: id, userId } } });
      return { liked: false };
    }
    await this.prisma.recordingLike.create({ data: { recordingId: id, userId } });
    return { liked: true };
  }

  async join(id: string, userId: string) {
    const recording = await this.prisma.recording.findUnique({ where: { id }, select: { id: true } });
    if (!recording) throw new NotFoundException("Recording not found");

    await this.prisma.recordingParticipant.upsert({
      where: { recordingId_userId: { recordingId: id, userId } },
      update: {},
      create: { recordingId: id, userId },
    });
    return { joined: true };
  }

  private assertOwnerOrAdmin(ownerId: string, userId: string, roles: string[]) {
    const isOwner = ownerId === userId;
    const isAdmin = roles.includes("admin") || roles.includes(SUPER_ADMIN_ROLE);
    if (!isOwner && !isAdmin) throw new ForbiddenException("You do not own this recording");
  }
}
