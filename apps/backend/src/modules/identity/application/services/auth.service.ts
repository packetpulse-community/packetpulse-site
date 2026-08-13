import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { UserRepository } from "../../domain/repositories/user.repository";
import { PrismaService } from "../../../../prisma/prisma.service";
import { TokenService } from "./token.service";
import { MailerService } from "../../infrastructure/email/mailer.service";
import { toPublicUser, PublicUser } from "../../domain/entities/user.entity";
import { RegisterDto, LoginDto } from "../dto/auth.dto";

const OTP_EXPIRY_MS = 10 * 60 * 1000;
const VERIFICATION_EXPIRY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly mailer: MailerService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.users.findByEmail(dto.email);
    if (existing) throw new ConflictException("An account with this email already exists");

    const passwordHash = await bcrypt.hash(dto.password, 12);

    // New registrants start unapproved + unverified. Admin auto-approval/verification
    // is an explicit branch here, not an implicit model-lifecycle side effect like the
    // old app's Mongoose pre-save hook (plan §4).
    const user = await this.users.create({
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      passwordHash,
      whatsappNumber: dto.whatsappNumber,
      roleNames: ["member"],
      isApproved: false,
      emailVerified: false,
    });

    await this.sendVerificationEmail(user.id, user.email);

    return toPublicUser(user);
  }

  async login(dto: LoginDto): Promise<PublicUser> {
    const user = await this.users.findByEmail(dto.email);
    if (!user) throw new UnauthorizedException("Invalid credentials");

    const matches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!matches) throw new UnauthorizedException("Invalid credentials");

    await this.users.markLastLogin(user.id);
    return toPublicUser(user);
  }

  async issueSession(userId: string, meta: { userAgent?: string; ipAddress?: string }) {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException();
    const publicUser = toPublicUser(user);
    const accessToken = this.tokens.signAccessToken(publicUser);
    const { raw: refreshToken } = await this.tokens.issueRefreshTokenFamily(userId, meta);
    return { accessToken, refreshToken, user: publicUser };
  }

  async refreshSession(rawRefreshToken: string, meta: { userAgent?: string; ipAddress?: string }) {
    const { userId, raw: refreshToken } = await this.tokens.rotateRefreshToken(rawRefreshToken, meta);
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException();
    const publicUser = toPublicUser(user);
    const accessToken = this.tokens.signAccessToken(publicUser);
    return { accessToken, refreshToken, user: publicUser };
  }

  async logout(rawRefreshToken: string | undefined) {
    if (rawRefreshToken) await this.tokens.revokeRefreshTokenFamily(rawRefreshToken);
  }

  async forgotPassword(email: string) {
    const user = await this.users.findByEmail(email);
    // Always return success regardless of whether the email exists — prevents
    // account enumeration via response-timing/content differences.
    if (!user) return;

    const { plain, hash } = this.tokens.generateOtp();
    await this.prisma.passwordReset.create({
      data: { userId: user.id, otpHash: hash, expiresAt: new Date(Date.now() + OTP_EXPIRY_MS) },
    });
    await this.mailer.send(user.email, "Your PacketPulse password reset code", `Your OTP is ${plain}. It expires in 10 minutes.`);
  }

  async verifyOtp(email: string, otp: string): Promise<{ tempToken: string }> {
    const user = await this.users.findByEmail(email);
    if (!user) throw new BadRequestException("Invalid or expired code");

    const otpHash = this.tokens.hashOtp(otp);
    const record = await this.prisma.passwordReset.findFirst({
      where: { userId: user.id, otpHash, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
    if (!record) throw new BadRequestException("Invalid or expired code");

    await this.prisma.passwordReset.update({ where: { id: record.id }, data: { consumedAt: new Date() } });

    // Short-lived temp token authorizing exactly one password reset, distinct from
    // the normal access token so it can't be reused for anything else.
    const tempToken = this.tokens.hashOtp(`${record.id}:${Date.now()}`);
    await this.prisma.passwordReset.update({ where: { id: record.id }, data: { otpHash: tempToken } });
    return { tempToken: `${record.id}.${tempToken}` };
  }

  async resetPassword(tempToken: string, newPassword: string) {
    const [id, hash] = tempToken.split(".");
    const record = id ? await this.prisma.passwordReset.findUnique({ where: { id } }) : null;
    if (!record || record.otpHash !== hash || !record.consumedAt) {
      throw new BadRequestException("Invalid or expired reset session");
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.users.updatePasswordHash(record.userId, passwordHash);

    // Password changed via reset — revoke all existing sessions for safety.
    await this.prisma.refreshToken.updateMany({
      where: { userId: record.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async sendVerificationEmail(userId: string, email: string) {
    const { plain, hash } = this.tokens.generateVerificationToken();
    await this.prisma.emailVerification.create({
      data: { userId, tokenHash: hash, expiresAt: new Date(Date.now() + VERIFICATION_EXPIRY_MS) },
    });
    await this.mailer.send(
      email,
      "Verify your PacketPulse email",
      `Verify your email using this token: ${plain} (expires in 24h).`,
    );
  }

  async verifyEmail(token: string) {
    const hash = this.tokens.hashOtp(token);
    const record = await this.prisma.emailVerification.findFirst({
      where: { tokenHash: hash, consumedAt: null, expiresAt: { gt: new Date() } },
    });
    if (!record) throw new BadRequestException("Invalid or expired verification token");

    await this.prisma.emailVerification.update({ where: { id: record.id }, data: { consumedAt: new Date() } });
    await this.users.markEmailVerified(record.userId);
  }
}
