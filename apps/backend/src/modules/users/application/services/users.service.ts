import { Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service";
import { toPublicUser, userWithRolesInclude, CredentialProvider } from "../../../identity";
import { EmailQueueService } from "../../../notifications";
import { AccountErasureService } from "../../../data-rights/application/account-erasure.service";
import { UpdateProfileDto, ChangePasswordDto } from "../dto/users.dto";

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailQueue: EmailQueueService,
    private readonly credentials: CredentialProvider,
    private readonly erasure: AccountErasureService,
  ) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: userWithRolesInclude });
    if (!user) throw new NotFoundException("User not found");
    return toPublicUser(user);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: dto,
      include: userWithRolesInclude,
    });
    return toPublicUser(user);
  }

  // Delegates to CredentialProvider — the old app called a `comparePassword`
  // method that didn't exist on the model, breaking this endpoint entirely (plan §3
  // known bug fixed by construction). Also makes this work identically whether the
  // password lives in our own passwordHash column or in Supabase Auth (platform-mode plan §2).
  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException("User not found");

    try {
      await this.credentials.verifyCredential(user.email, dto.currentPassword, user.passwordHash);
    } catch {
      throw new UnauthorizedException("Current password is incorrect");
    }

    const result = await this.credentials.updateCredential(user.id, user.email, dto.newPassword);
    if (result.passwordHash) {
      await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: result.passwordHash } });
    }

    // Security-relevant change — revoke all other sessions.
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.emailQueue.sendPasswordChangedNotice(user.email);
  }

  // TASK-046: no longer an immediate hard delete (which left the Supabase login behind and cascaded
  // into other members' threads, S-5/D-2). Re-checks the password, deactivates the account and
  // schedules the erasure after the grace period. See AccountErasureService.
  async deleteAccount(userId: string, password: string) {
    return this.erasure.request(userId, password);
  }
}
