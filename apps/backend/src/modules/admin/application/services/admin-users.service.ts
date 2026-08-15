import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../../prisma/prisma.service";
import { paginate, prismaSkip } from "../../../../common/dto/pagination.util";
import { AdminUserListQueryDto, AssignRolesDto } from "../dto/admin.dto";
import { userWithRolesInclude, toPublicUser } from "../../../identity";
import type { UserWithRoles } from "../../../identity";
import { EmailQueueService, NotificationsService } from "../../../notifications";
import { AdminActivityLogService } from "./admin-activity-log.service";

// toPublicUser (identity module) deliberately omits createdAt/lastLoginAt since it's
// also used for /auth/me — those fields shouldn't leak into every session response.
// Admin list/detail views need them (dashboard's "Joined"/"Last Login" columns), so
// this admin-only wrapper adds them back on top of the shared safe-fields subset.
function toAdminUser(user: UserWithRoles) {
  return { ...toPublicUser(user), createdAt: user.createdAt, lastLoginAt: user.lastLoginAt };
}

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailQueue: EmailQueueService,
    private readonly notifications: NotificationsService,
    private readonly activityLog: AdminActivityLogService,
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
    return paginate(data.map(toAdminUser), query.page, query.limit, total);
  }

  pendingApproval() {
    return this.prisma.user.findMany({
      where: { isApproved: false, emailVerified: true },
      include: userWithRolesInclude,
      orderBy: { createdAt: "asc" },
    }).then((users) => users.map(toAdminUser));
  }

  async getById(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, include: userWithRolesInclude });
    if (!user) throw new NotFoundException("User not found");
    return toAdminUser(user);
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
      this.activityLog.log(approvedById, approved ? "user_approved" : "user_unapproved", "user", id, {
        email: user.email,
      }),
    ]);

    return this.getById(id);
  }

  async assignRoles(id: string, dto: AssignRolesDto, actorId: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException("User not found");

    const roles = await this.prisma.role.findMany({ where: { name: { in: dto.roleNames } } });
    if (roles.length !== dto.roleNames.length) throw new BadRequestException("One or more role names are invalid");

    await this.prisma.$transaction([
      this.prisma.userRole.deleteMany({ where: { userId: id } }),
      this.prisma.userRole.createMany({ data: roles.map((role) => ({ userId: id, roleId: role.id })) }),
    ]);

    await Promise.all([
      this.emailQueue.sendRoleChangeNotice(user.email, dto.roleNames),
      this.activityLog.log(actorId, "user_roles_changed", "user", id, { email: user.email, roles: dto.roleNames }),
    ]);

    return this.getById(id);
  }

  async delete(id: string, actorId: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException("User not found");
    // Logged BEFORE deleting: if id === actorId (an admin deleting their own
    // account), inserting the log row after the delete would violate the
    // admin_activity_logs.actor_id FK, since it'd reference an id that no longer
    // exists — onDelete: SetNull only rewrites *existing* rows on a later delete,
    // it doesn't let a *new* insert reference an already-gone id.
    await this.activityLog.log(actorId, "user_deleted", "user", undefined, { email: user.email });
    await this.prisma.user.delete({ where: { id } });
  }
}
