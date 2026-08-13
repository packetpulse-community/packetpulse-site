import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { PrismaService } from "../../../../prisma/prisma.service";
import { PublicUser } from "../../domain/entities/user.entity";

export interface AccessTokenPayload {
  sub: string;
  email: string;
  roles: string[];
  permissions: string[];
}

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
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
    const expiresInMs = this.parseDuration(this.config.get<string>("JWT_REFRESH_EXPIRES_IN") ?? "7d");

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

    if (existing.revokedAt || existing.expiresAt < new Date()) {
      // Reuse of a revoked/expired token — treat as compromise and kill the family.
      await this.prisma.refreshToken.updateMany({
        where: { familyId: existing.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException("Refresh token reuse detected — session revoked");
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

  private parseDuration(value: string): number {
    const match = /^(\d+)([smhd])$/.exec(value);
    if (!match) return 7 * 24 * 60 * 60 * 1000;
    const amount = Number(match[1]);
    const unitMs = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2] as "s" | "m" | "h" | "d"];
    return amount * unitMs;
  }
}
