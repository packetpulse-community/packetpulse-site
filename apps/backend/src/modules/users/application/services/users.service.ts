import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { PrismaService } from "../../../../prisma/prisma.service";
import { toPublicUser, userWithRolesInclude } from "../../../identity";
import { UpdateProfileDto, ChangePasswordDto } from "../dto/users.dto";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

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

  // Implements the comparison directly against bcrypt — the old app called a
  // `comparePassword` method that didn't exist on the model, breaking this endpoint
  // entirely (plan §3 known bug fixed by construction).
  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException("User not found");

    const matches = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!matches) throw new UnauthorizedException("Current password is incorrect");

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });

    // Security-relevant change — revoke all other sessions.
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async deleteAccount(userId: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException("User not found");

    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) throw new BadRequestException("Password is incorrect");

    await this.prisma.user.delete({ where: { id: userId } });
  }
}
