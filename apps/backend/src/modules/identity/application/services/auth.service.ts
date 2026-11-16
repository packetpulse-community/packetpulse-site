import { BadRequestException, ConflictException, ForbiddenException, HttpException, HttpStatus, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import { UserRepository } from "../../domain/repositories/user.repository";
import { CredentialProvider } from "../../domain/providers/credential-provider";
import { PrismaService } from "../../../../prisma/prisma.service";
import { TokenService } from "./token.service";
import { EmailVerificationService } from "./email-verification.service";
import { EmailQueueService } from "../../../notifications";
import { toPublicUser, PublicUser } from "../../domain/entities/user.entity";
import { SUPER_ADMIN_ROLE } from "../../domain/constants/permissions.constants";
import { SiteStatusService } from "../../../../common/site-status/site-status.service";
import { maintenanceException } from "../../../../common/site-status/maintenance.constants";
import { RegisterDto, RegisterAdminDto, LoginDto } from "../dto/auth.dto";
import { REDIS_CLIENT } from "../../../../common/redis/redis.constants";

const OTP_EXPIRY_MS = 10 * 60 * 1000;
// After a correct code the member has this long to choose a new password.
const RESET_SESSION_MS = 10 * 60 * 1000;
// A 6-digit code has only a million possibilities, so wrong guesses are counted per email
// address (not per IP, which a caller can vary) and the code locks after a few mistakes.
const OTP_MAX_FAILURES = 5;
const OTP_LOCK_SECONDS = 15 * 60;

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly credentials: CredentialProvider,
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly emailQueue: EmailQueueService,
    private readonly emailVerification: EmailVerificationService,
    private readonly siteStatus: SiteStatusService,
    private readonly config: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.users.findByEmail(dto.email);
    if (existing) throw new ConflictException("An account with this email already exists");

    // autoConfirm: true regardless of role — Supabase mode's own "email confirmed"
    // flag is a login gate at the Supabase Auth layer, separate from and unrelated
    // to this app's own emailVerified/OTP flow below, which gates specific actions
    // rather than login itself (matches docker mode, where login never checked
    // emailVerified). Leaving Supabase's flag false would block signInWithPassword
    // entirely until a Supabase-side confirmation email was clicked — a flow this
    // app doesn't use.
    const credential = await this.credentials.createCredential(dto.email, dto.password, { autoConfirm: true });

    // New registrants start unapproved + unverified. No email is sent here — the
    // verification link goes out only once an admin approves the account
    // (AdminUsersService.setApproval), so unreviewed signups never get one. Admin
    // auto-approval/verification is an explicit branch, not an implicit
    // model-lifecycle side effect like the old app's Mongoose pre-save hook (plan §4).
    const user = await this.users.create({
      id: credential.id,
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      passwordHash: credential.passwordHash,
      whatsappNumber: dto.whatsappNumber,
      professionalExperience: dto.professionalExperience,
      roleNames: ["member"],
      isApproved: false,
      emailVerified: false,
    });

    return toPublicUser(user);
  }

  // Admin self-registration gated by a shared secret (kept from the old app's
  // design), not admin-invites-admin — but unlike the old app, the code is
  // asserted present/non-default at boot (common/config/env.schema.ts) rather than
  // silently accepting an empty secret (plan §11). Admins are auto-approved and
  // auto-verified on creation — made explicit here, not an implicit hook side
  // effect (plan §4).
  async registerAdmin(dto: RegisterAdminDto) {
    const expected = this.config.get<string>("ADMIN_SECURE_CODE");
    if (dto.adminSecureCode !== expected) throw new UnauthorizedException("Invalid admin registration code");

    const existing = await this.users.findByEmail(dto.email);
    if (existing) throw new ConflictException("An account with this email already exists");

    const credential = await this.credentials.createCredential(dto.email, dto.password, { autoConfirm: true });
    const user = await this.users.create({
      id: credential.id,
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      passwordHash: credential.passwordHash,
      whatsappNumber: dto.whatsappNumber,
      professionalExperience: dto.professionalExperience,
      roleNames: ["admin"],
      isApproved: true,
      emailVerified: true,
    });

    return toPublicUser(user);
  }

  async login(dto: LoginDto): Promise<PublicUser> {
    const user = await this.users.findByEmail(dto.email);
    if (!user) throw new UnauthorizedException("Invalid credentials");

    await this.credentials.verifyCredential(dto.email, dto.password, user.passwordHash);

    // Checked only after the password is verified, so these messages can't be used
    // to probe which emails are registered. Admins are always approved + verified.
    const publicUser = toPublicUser(user);
    const isAdmin = publicUser.roles.includes(SUPER_ADMIN_ROLE) || publicUser.roles.includes("admin");
    // Maintenance mode: only admins may start a session (MaintenanceGuard blocks
    // everyone else's requests; this stops a non-admin getting a session at all).
    if (!isAdmin && (await this.siteStatus.isMaintenance())) throw maintenanceException();
    if (!isAdmin && !user.isApproved) {
      throw new ForbiddenException(
        "Your account is pending admin approval. You'll receive an email to verify your address once it's approved.",
      );
    }
    if (!isAdmin && !user.emailVerified) {
      // Approved but never clicked (or let expire) the link from the approval
      // email — re-send rather than leave them stuck. The login route's strict
      // throttle bounds how often this can fire.
      await this.emailVerification.send(user.id, user.email, "reminder");
      throw new ForbiddenException(
        "Please verify your email before signing in. We've sent a new verification link to your inbox.",
      );
    }

    await this.users.markLastLogin(user.id);
    return publicUser;
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
    await this.emailQueue.sendPasswordResetOtp(user.email, plain);
  }

  private otpFailureKey(email: string) {
    return `pwreset:fail:${this.tokens.hashOtp(email.trim().toLowerCase())}`;
  }

  // Keyed by email hash whether or not the account exists, so the lock gives no hint about
  // which addresses are registered.
  private async assertOtpNotLocked(key: string) {
    const failures = Number((await this.redis.get(key)) ?? 0);
    if (failures >= OTP_MAX_FAILURES) {
      throw new HttpException("Too many incorrect codes. Please wait 15 minutes and try again.", HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private async rejectOtp(key: string): Promise<never> {
    const failures = await this.redis.incr(key);
    if (failures === 1) await this.redis.expire(key, OTP_LOCK_SECONDS);
    throw new BadRequestException("Invalid or expired code");
  }

  async verifyOtp(email: string, otp: string): Promise<{ tempToken: string }> {
    const failureKey = this.otpFailureKey(email);
    await this.assertOtpNotLocked(failureKey);

    const user = await this.users.findByEmail(email);
    if (!user) return this.rejectOtp(failureKey);

    const otpHash = this.tokens.hashOtp(otp);
    const record = await this.prisma.passwordReset.findFirst({
      where: { userId: user.id, otpHash, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
    if (!record) return this.rejectOtp(failureKey);

    await this.redis.del(failureKey);

    // The code is spent. In exchange the member gets a random, single-use session secret
    // that authorises exactly one password reset, and only for a short time. Only its hash
    // is stored, so it cannot be rebuilt from the database.
    const session = this.tokens.generateVerificationToken();
    await this.prisma.passwordReset.update({
      where: { id: record.id },
      data: { consumedAt: new Date(), otpHash: session.hash, expiresAt: new Date(Date.now() + RESET_SESSION_MS) },
    });
    return { tempToken: `${record.id}.${session.plain}` };
  }

  async resetPassword(tempToken: string, newPassword: string) {
    const [id, secret] = tempToken.split(".");
    const invalid = () => new BadRequestException("Invalid or expired reset session");
    const record = id ? await this.prisma.passwordReset.findUnique({ where: { id } }) : null;
    if (!record || !secret || !record.consumedAt || record.otpHash !== this.tokens.hashOtp(secret)) throw invalid();

    // Claim the session atomically: only one request can ever turn a valid session into a
    // reset, so a replay (or a race between two requests) is refused.
    const claimed = await this.prisma.passwordReset.updateMany({
      where: { id: record.id, otpHash: record.otpHash, consumedAt: { not: null }, expiresAt: { gt: new Date() } },
      data: { expiresAt: new Date(0) },
    });
    if (claimed.count !== 1) throw invalid();

    const user = await this.users.findById(record.userId);
    if (!user) throw invalid();

    const result = await this.credentials.updateCredential(user.id, user.email, newPassword);
    if (result.passwordHash) await this.users.updatePasswordHash(user.id, result.passwordHash);

    // Password changed via reset: close any other pending reset codes and revoke all
    // existing sessions for safety.
    await this.prisma.passwordReset.updateMany({
      where: { userId: record.userId, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    await this.prisma.refreshToken.updateMany({
      where: { userId: record.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.emailQueue.sendPasswordChangedNotice(user.email);
  }

  async verifyEmail(token: string) {
    const hash = this.tokens.hashOtp(token);
    const record = await this.prisma.emailVerification.findFirst({
      where: { tokenHash: hash, consumedAt: null, expiresAt: { gt: new Date() } },
    });
    if (!record) throw new BadRequestException("Invalid or expired verification token");

    await this.prisma.emailVerification.update({ where: { id: record.id }, data: { consumedAt: new Date() } });
    await this.users.markEmailVerified(record.userId);

    const user = await this.users.findById(record.userId);
    if (user) await this.emailQueue.sendWelcomeEmail(user.email, user.firstName);
  }
}
