import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../../prisma/prisma.service";
import { paginate, prismaSkip } from "../../../../common/dto/pagination.util";
import { AdminUserListQueryDto, AssignRolesDto } from "../dto/admin.dto";
import { userWithRolesInclude, toPublicUser } from "../../../identity";
import { EmailQueueService, NotificationsService } from "../../../notifications";

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailQueue: EmailQueueService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(query: AdminUserListQueryDto) {
    const skip = prismaSkip(query.page, query.limit);
    const where: Prisma.UserWhereInput = {
      isApproved: query.approved,
      OR: query.search
        ? [
            { firstName: { contains: query.search, mode: "insensitive" } },
            { lastName: { contains: query.search, mode: "insensitive" } },
            { email: { contains: query.search, mode: "insensitive" } },
          ]
        : undefined,
    };

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: userWithRolesInclude,
        orderBy: { createdAt: "desc" },
        skip,
        take: query.limit,
      }),
      this.prisma.user.count({ where }),
    ]);
    return paginate(data.map(toPublicUser), query.page, query.limit, total);
  }

  pendingApproval() {
    return this.prisma.user.findMany({
      where: { isApproved: false, emailVerified: true },
      include: userWithRolesInclude,
      orderBy: { createdAt: "asc" },
    }).then((users) => users.map(toPublicUser));
  }

  async getById(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, include: userWithRolesInclude });
    if (!user) throw new NotFoundException("User not found");
    return toPublicUser(user);
  }

  async setApproval(id: string, approvedById: string, approved: boolean) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException("User not found");
    if (approved && !user.emailVerified) {
      // Codifies "verified email" as a precondition of "approved member" —
      // the old app never enforced this (plan §4).
      throw new BadRequestException("Cannot approve a user who has not verified their email");
    }

    await this.prisma.user.update({
      where: { id },
      data: {
        isApproved: approved,
        approvedById: approved ? approvedById : null,
        approvedAt: approved ? new Date() : null,
      },
    });

    await Promise.all([
      this.emailQueue.sendApprovalNotice(user.email, approved),
      this.notifications.notify(id, "approval", { approved }),
    ]);

    return this.getById(id);
  }

  async assignRoles(id: string, dto: AssignRolesDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException("User not found");

    const roles = await this.prisma.role.findMany({ where: { name: { in: dto.roleNames } } });
    if (roles.length !== dto.roleNames.length) throw new BadRequestException("One or more role names are invalid");

    await this.prisma.$transaction([
      this.prisma.userRole.deleteMany({ where: { userId: id } }),
      this.prisma.userRole.createMany({ data: roles.map((role) => ({ userId: id, roleId: role.id })) }),
    ]);

    await this.emailQueue.sendRoleChangeNotice(user.email, dto.roleNames);

    return this.getById(id);
  }

  async delete(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException("User not found");
    await this.prisma.user.delete({ where: { id } });
  }
}
