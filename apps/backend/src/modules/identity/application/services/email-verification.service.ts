import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service";
import { EmailQueueService } from "../../../notifications";
import { TokenService } from "./token.service";

const VERIFICATION_EXPIRY_MS = 24 * 60 * 60 * 1000;

// Issues a fresh verification token and emails its link. Exported from identity so
// the admin module can trigger it on approval — the first verification email a new
// member ever receives is sent at that point, never at registration.
@Injectable()
export class EmailVerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly emailQueue: EmailQueueService,
  ) {}

  // "approval" = the combined "you're approved, now verify" email; "reminder" = a
  // plain re-send for an already-approved user whose earlier link expired.
  async send(userId: string, email: string, kind: "approval" | "reminder") {
    const { plain, hash } = this.tokens.generateVerificationToken();
    await this.prisma.emailVerification.create({
      data: { userId, tokenHash: hash, expiresAt: new Date(Date.now() + VERIFICATION_EXPIRY_MS) },
    });
    if (kind === "approval") await this.emailQueue.sendApprovedVerificationEmail(email, plain);
    else await this.emailQueue.sendVerificationEmail(email, plain);
  }
}
