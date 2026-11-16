import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { PrismaService } from "../../../../prisma/prisma.service";
import { PublicUser } from "../../domain/entities/user.entity";
import { EmailQueueService } from "../../../notifications";
import { STAFF_ROLES } from "../../domain/constants/permissions.constants";

export interface AccessTokenPayload {
  sub: string;
  email: string;
  roles: string[];
  permissions: string[];
}

const MINUTE_MS = 60_000;

export interface SessionLimits {
  idleMs: number;
  // Only staff have an absolute limit, measured from the first login of the family.
  absoluteMs: number | null;
}

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly emailQueue: EmailQueueService,
  ) {}

  signAccessToken(user: PublicUser): string {
    const payload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      roles: user.roles,
      permissions: user.permissions,
    };
    return this.jwt.sign(payload, {
      secret: this.config.get<string>("JWT_ACCESS_SECRET"),
      expiresIn: this.config.get<string>("JWT_ACCESS_EXPIRES_IN"),
    });
  }

  // Issues the first refresh token in a new rotation family. Every subsequent refresh
  // replaces it via rotateRefreshToken — reuse of a revoked token revokes the whole
  // family, which is the replay-attack defense the old app's bare re-signed JWT lacked.
  async issueRefreshTokenFamily(userId: string, meta: { userAgent?: string; ipAddress?: string }) {
    const familyId = randomUUID();
    return this.createRefreshToken(userId, familyId, meta);
  }

  private async createRefreshToken(
    userId: string,
    familyId: string,
    meta: { userAgent?: string; ipAddress?: string },
  ) {
    const rawToken = randomBytes(48).toString("hex");
    // The row's expiry is the idle limit from now: each rotation writes a new row, so this
    // is a sliding window. The absolute staff limit is enforced in rotateRefreshToken.
    const { idleMs: expiresInMs } = await this.sessionLimitsFor(userId);

    const record = await this.prisma.refreshToken.create({
      data: {
        userId,
        familyId,
        tokenHash: sha256(rawToken),
        expiresAt: new Date(Date.now() + expiresInMs),
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
      },
    });

    // Encode id + secret so lookup doesn't require scanning hashes.
    return { raw: `${record.id}.${rawToken}`, record };
  }

  async sessionLimitsFor(userId: string): Promise<SessionLimits> {
    const staffRole = await this.prisma.userRole.findFirst({
      where: { userId, role: { name: { in: [...STAFF_ROLES] } } },
      select: { userId: true },
    });
    if (staffRole) {
      return {
        idleMs: this.minutes("SESSION_STAFF_IDLE_MINUTES", 30) * MINUTE_MS,
        absoluteMs: this.minutes("SESSION_STAFF_ABSOLUTE_MINUTES", 480) * MINUTE_MS,
      };
    }
    return { idleMs: this.minutes("SESSION_MEMBER_IDLE_MINUTES", 43200) * MINUTE_MS, absoluteMs: null };
  }

  private minutes(key: string, fallback: number): number {
    return Number(this.config.get<number>(key) ?? fallback);
  }

  // Rotates a presented refresh token. If the token was already rotated/revoked
  // (reuse), the entire family is revoked and the caller must re-authenticate —
  // this is what makes token theft detectable instead of silently exploitable.
  async rotateRefreshToken(rawToken: string, meta: { userAgent?: string; ipAddress?: string }) {
    const [id, secret] = rawToken.split(".");
    if (!id || !secret) throw new UnauthorizedException("Malformed refresh token");

    const existing = await this.prisma.refreshToken.findUnique({ where: { id } });
    if (!existing || existing.tokenHash !== sha256(secret)) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    if (existing.revokedAt) {
      // Reuse of an already-rotated-away token — this is the actual compromise
      // signal (a merely expired-but-never-rotated token, handled below, is normal
      // inactivity, not an attack — alerting on that would be a false positive).
      await this.prisma.refreshToken.updateMany({
        where: { familyId: existing.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      const user = await this.prisma.user.findUnique({ where: { id: existing.userId } });
      if (user) await this.emailQueue.sendSuspiciousRefreshReuseAlert(user.email);
      throw new UnauthorizedException("Refresh token reuse detected — session revoked");
    }

    if (existing.expiresAt < new Date()) {
      throw new UnauthorizedException("Refresh token expired");
    }

    // Session limits (SEC-05). The presented token is the newest row of its family, so its
    // createdAt is the last activity and the family's oldest createdAt is the first login.
    // Roles are read now, so a member promoted to admin gets the staff limits at once.
    const limits = await this.sessionLimitsFor(existing.userId);
    const now = Date.now();
    let overLimit = now - existing.createdAt.getTime() > limits.idleMs;
    if (!overLimit && limits.absoluteMs !== null) {
      const first = await this.prisma.refreshToken.aggregate({
        where: { familyId: existing.familyId },
        _min: { createdAt: true },
      });
      const start = first._min.createdAt ?? existing.createdAt;
      overLimit = now - start.getTime() > limits.absoluteMs;
    }
    if (overLimit) {
      await this.prisma.refreshToken.updateMany({
        where: { familyId: existing.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException("Session expired — please sign in again");
    }

    const next = await this.createRefreshToken(existing.userId, existing.familyId, meta);
    await this.prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date(), replacedById: next.record.id },
    });

    return { userId: existing.userId, raw: next.raw };
  }

  async revokeRefreshTokenFamily(rawToken: string) {
    const [id] = rawToken.split(".");
    if (!id) return;
    const existing = await this.prisma.refreshToken.findUnique({ where: { id } });
    if (!existing) return;
    await this.prisma.refreshToken.updateMany({
      where: { familyId: existing.familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  generateOtp(): { plain: string; hash: string } {
    const plain = String(Math.floor(100000 + Math.random() * 900000));
    return { plain, hash: sha256(plain) };
  }

  hashOtp(plain: string): string {
    return sha256(plain);
  }

  generateVerificationToken(): { plain: string; hash: string } {
    const plain = randomBytes(32).toString("hex");
    return { plain, hash: sha256(plain) };
  }
}
