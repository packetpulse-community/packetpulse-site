import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service";
import { EmailQueueService } from "../../../notifications";
import { TokenService } from "./token.service";
import { EmailCodeService } from "./email-code.service";

const VERIFICATION_EXPIRY_MS = 24 * 60 * 60 * 1000;

// Issues a fresh verification token and a 6-digit code (PRD-001) and emails both in one message:
// the code is the primary way, the 24 h link still works. The code and the link are separate
// records, so either one verifies the address. Used where the system, not the member, starts it
// (admin approval, sign-in of an unverified member), so the member resend cooldown does not apply.
// Issues a fresh verification token and emails its link. Exported from identity so
// the admin module can trigger it on approval — the first verification email a new
// member ever receives is sent at that point, never at registration.
@Injectable()
export class EmailVerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly emailQueue: EmailQueueService,
    private readonly codes: EmailCodeService,
  ) {}

  // "approval" = the combined "you're approved, now verify" email; "reminder" = a
  // plain re-send for an already-approved user whose earlier link expired.
  async send(userId: string, email: string, kind: "approval" | "reminder") {
    const { plain, hash } = this.tokens.generateVerificationToken();
    await this.prisma.emailVerification.create({
      data: { userId, tokenHash: hash, expiresAt: new Date(Date.now() + VERIFICATION_EXPIRY_MS) },
    });
    const code = await this.codes.create(userId);
    if (kind === "approval") await this.emailQueue.sendApprovedVerificationEmail(email, plain, code);
    else await this.emailQueue.sendVerificationEmail(email, plain, code);
  }
}
