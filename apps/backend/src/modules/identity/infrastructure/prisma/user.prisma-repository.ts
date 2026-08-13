import { Injectable } from "@nestjs/common";
import { ProfessionalExperience } from "@prisma/client";
import { PrismaService } from "../../../../prisma/prisma.service";
import { UserRepository } from "../../domain/repositories/user.repository";
import { userWithRolesInclude } from "../../domain/entities/user.entity";

@Injectable()
export class UserPrismaRepository extends UserRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email }, include: userWithRolesInclude });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id }, include: userWithRolesInclude });
  }

  async create(data: {
    firstName: string;
    lastName: string;
    email: string;
    passwordHash: string;
    whatsappNumber?: string;
    professionalExperience?: ProfessionalExperience;
    roleNames: string[];
    isApproved: boolean;
    emailVerified: boolean;
  }) {
    return this.prisma.user.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        passwordHash: data.passwordHash,
        whatsappNumber: data.whatsappNumber,
        professionalExperience: data.professionalExperience,
        isApproved: data.isApproved,
        emailVerified: data.emailVerified,
        roles: {
          create: data.roleNames.map((name) => ({
            role: { connect: { name } },
          })),
        },
      },
      include: userWithRolesInclude,
    });
  }

  async updatePasswordHash(userId: string, passwordHash: string) {
    // A single, explicit field update — never a whole-document "save" that could
    // accidentally re-trigger hashing on unrelated fields (the old app's bug, plan §3).
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  }

  async markEmailVerified(userId: string) {
    await this.prisma.user.update({ where: { id: userId }, data: { emailVerified: true } });
  }

  async markLastLogin(userId: string) {
    await this.prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
  }

  async setApproval(userId: string, approved: boolean, approvedById: string | null) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        isApproved: approved,
        approvedById: approved ? approvedById : null,
        approvedAt: approved ? new Date() : null,
      },
    });
  }
}
