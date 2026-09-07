import { Injectable } from "@nestjs/common";
import { Prisma, ClientLogLevel } from "@prisma/client";
import { PrismaService } from "../../../../prisma/prisma.service";
import { paginate, prismaSkip } from "../../../../common/dto/pagination.util";
import { CreateClientLogDto, ClientLogListQueryDto } from "../dto/logs.dto";

@Injectable()
export class LogsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateClientLogDto, meta: { userId?: string; ip?: string; userAgent?: string }) {
    return this.prisma.clientLog.create({
      data: {
        level: dto.level as ClientLogLevel,
        context: dto.context,
        message: dto.message,
        data: dto.data as Prisma.InputJsonValue | undefined,
        userId: meta.userId,
        ip: meta.ip,
        userAgent: meta.userAgent,
      },
    });
  }

  async list(query: ClientLogListQueryDto) {
    const skip = prismaSkip(query.page, query.limit);
    const where: Prisma.ClientLogWhereInput = {
      level: query.level as ClientLogLevel | undefined,
      createdAt: {
        gte: query.fromDate,
        lte: query.toDate,
      },
      OR: query.search
        ? [
            { message: { contains: query.search, mode: "insensitive" } },
            { context: { contains: query.search, mode: "insensitive" } },
          ]
        : undefined,
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.clientLog.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: query.limit }),
      this.prisma.clientLog.count({ where }),
    ]);
    return paginate(data, query.page, query.limit, total);
  }
}
