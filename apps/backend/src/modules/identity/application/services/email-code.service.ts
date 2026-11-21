import { BadRequestException, HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, createHmac, randomInt, timingSafeEqual } from "node:crypto";
import Redis from "ioredis";
import {
  EMAIL_CODE_LENGTH,
  EMAIL_CODE_LOCK_MINUTES,
  EMAIL_CODE_MAX_ATTEMPTS,
  EMAIL_CODE_MAX_SENDS_PER_HOUR,
  EMAIL_CODE_RESEND_COOLDOWN_SECONDS,
  EMAIL_CODE_TTL_MINUTES,
} from "@packetpulse/types";
import { PrismaService } from "../../../../prisma/prisma.service";
import { EmailQueueService } from "../../../notifications";
import { REDIS_CLIENT } from "../../../../common/redis/redis.constants";
import { UserRepository } from "../../domain/repositories/user.repository";

const INVALID = "Invalid or expired code";

// TASK-022 / PRD-001 / API-002 / TEST-002: the 6-digit email verification code.
//  - only an HMAC of the code is stored (keyed with the server secret and the user id), so a copy
//    of the table cannot be used to read or guess codes offline
//  - 10-minute expiry; a new code retires the older ones
//  - wrong guesses are counted per email address (not per IP, which a caller can vary), with the
//    same Redis lock pattern as the password-reset code: 5 mistakes lock the address for 15
//    minutes, and a locked address refuses even the right code
//  - resend cooldown and an hourly cap are keyed by email hash whether or not an account exists,
//    so neither reveals which addresses are registered
//  - the code is single use: it is claimed by one conditional UPDATE, so two parallel requests
//    with the right code can never both succeed
@Injectable()
export class EmailCodeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly emailQueue: EmailQueueService,
    private readonly users: UserRepository,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  private emailKey(email: string) {
    return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
  }
  private failKey(email: string) {
    return `emailcode:fail:${this.emailKey(email)}`;
  }

  hashCode(userId: string, code: string): string {
    const secret = this.config.get<string>("JWT_ACCESS_SECRET") ?? "";
    return createHmac("sha256", secret).update(`email-code:${userId}:${code}`).digest("hex");
  }

  /** Cooldown and hourly cap for the address; throws 429 when either is hit. Keyed without the account. */
  async assertCanSend(email: string): Promise<void> {
    const key = this.emailKey(email);
    const sends = await this.redis.incr(`emailcode:sends:${key}`);
    if (sends === 1) await this.redis.expire(`emailcode:sends:${key}`, 3600);
    if (sends > EMAIL_CODE_MAX_SENDS_PER_HOUR) {
      throw new HttpException("Too many codes requested. Please try again in an hour.", HttpStatus.TOO_MANY_REQUESTS);
    }
    const acquired = await this.redis.set(`emailcode:cooldown:${key}`, "1", "EX", EMAIL_CODE_RESEND_COOLDOWN_SECONDS, "NX");
    if (acquired !== "OK") {
      const ttl = await this.redis.ttl(`emailcode:cooldown:${key}`);
      throw new HttpException(
        `Please wait ${ttl > 0 ? ttl : EMAIL_CODE_RESEND_COOLDOWN_SECONDS} seconds before asking for another code.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /** Creates a code for the user, retires older ones, and returns the plain code (for the caller to email). */
  async create(userId: string): Promise<string> {
    const code = String(randomInt(0, 10 ** EMAIL_CODE_LENGTH)).padStart(EMAIL_CODE_LENGTH, "0");
    await this.prisma.$transaction([
      this.prisma.emailVerificationCode.updateMany({ where: { userId, consumedAt: null }, data: { consumedAt: new Date() } }),
      this.prisma.emailVerificationCode.create({
        data: { userId, codeHash: this.hashCode(userId, code), expiresAt: new Date(Date.now() + EMAIL_CODE_TTL_MINUTES * 60_000) },
      }),
    ]);
    return code;
  }

  /** Creates a code and emails it on its own. The caller has already passed assertCanSend where it applies. */
  async issueAndEmail(userId: string, email: string): Promise<void> {
    await this.emailQueue.sendEmailCode(email, await this.create(userId));
  }

  /**
   * Resend for a public caller. Answers the same whether or not the account exists or is eligible
   * (only the shared cooldown/cap, which apply to every address, can refuse).
   */
  async resend(email: string, canReceiveCode: (user: NonNullable<Awaited<ReturnType<UserRepository["findByEmail"]>>>) => Promise<boolean>) {
    await this.assertCanSend(email);
    const user = await this.users.findByEmail(email);
    if (user && !user.emailVerified && (await canReceiveCode(user))) await this.issueAndEmail(user.id, user.email);
  }

  private async assertNotLocked(email: string) {
    const failures = Number((await this.redis.get(this.failKey(email))) ?? 0);
    if (failures >= EMAIL_CODE_MAX_ATTEMPTS) {
      throw new HttpException(
        `Too many incorrect codes. Please wait ${EMAIL_CODE_LOCK_MINUTES} minutes and try again.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async reject(email: string): Promise<never> {
    const key = this.failKey(email);
    const failures = await this.redis.incr(key);
    if (failures === 1) await this.redis.expire(key, EMAIL_CODE_LOCK_MINUTES * 60);
    throw new BadRequestException(INVALID);
  }

  /**
   * Checks a code and, if it is right, spends it. Returns the user id. Every failure (unknown
   * address, no live code, wrong code, already verified) gives the same 400 and counts as a miss.
   */
  async consume(email: string, code: string): Promise<string> {
    await this.assertNotLocked(email);
    const user = await this.users.findByEmail(email);
    // An unknown address still pays for one hash so timing does not tell it apart from a wrong code.
    const record = user
      ? await this.prisma.emailVerificationCode.findFirst({
          where: { userId: user.id, consumedAt: null, expiresAt: { gt: new Date() } },
          orderBy: { createdAt: "desc" },
        })
      : null;
    const expected = Buffer.from(record?.codeHash ?? this.hashCode("none", "000000"), "hex");
    const given = Buffer.from(this.hashCode(user?.id ?? "none", code), "hex");
    const matches = timingSafeEqual(expected, given);
    if (!user || !record || user.emailVerified || !matches) return this.reject(email);

    const claimed = await this.prisma.emailVerificationCode.updateMany({
      where: { id: record.id, consumedAt: null, expiresAt: { gt: new Date() } },
      data: { consumedAt: new Date() },
    });
    if (claimed.count !== 1) return this.reject(email);
    await this.redis.del(this.failKey(email));
    return user.id;
  }
}
