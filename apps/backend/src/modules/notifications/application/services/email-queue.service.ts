import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";
import { frontendUrl } from "../../../../common/config/frontend-url";
import { EmailTemplate } from "../../infrastructure/email/templates";

import { EMAIL_QUEUE, emailJobOptions, idempotencyJobId } from "../../infrastructure/queue/queue-config";

export interface EmailJobData {
  to: string;
  template: EmailTemplate;
}

// Public API other modules depend on (identity, admin) — enqueues onto the `email`
// queue this module owns rather than sending synchronously, so email delivery never
// blocks the request thread (plan §5).
@Injectable()
export class EmailQueueService {
  constructor(
    @InjectQueue(EMAIL_QUEUE) private readonly emailQueue: Queue<EmailJobData>,
    private readonly config: ConfigService,
  ) {}

  sendVerificationEmail(to: string, token: string) {
    return this.enqueue(to, { name: "verification", link: this.verificationLink(token) }, ["verification", token]);
  }

  // Sent once, when an admin approves a new member — approval notice and the
  // email-verification link in a single message.
  sendApprovedVerificationEmail(to: string, token: string) {
    return this.enqueue(to, { name: "approved-verify", link: this.verificationLink(token) }, ["approved-verify", token]);
  }

  sendWelcomeEmail(to: string, firstName: string) {
    return this.enqueue(to, { name: "welcome", firstName, loginLink: `${frontendUrl(this.config)}/login` }, [
      "welcome",
      to.toLowerCase(),
    ]);
  }

  sendPasswordResetOtp(to: string, otp: string) {
    return this.enqueue(to, { name: "password-reset-otp", otp }, ["password-reset-otp", to.toLowerCase(), otp]);
  }

  sendApprovalNotice(to: string, approved: boolean) {
    return this.enqueue(to, { name: "approval", approved });
  }

  sendRoleChangeNotice(to: string, roleNames: string[]) {
    return this.enqueue(to, { name: "role-change", roleNames });
  }

  sendPasswordChangedNotice(to: string) {
    return this.enqueue(to, { name: "password-changed" });
  }

  sendSuspiciousRefreshReuseAlert(to: string) {
    return this.enqueue(to, { name: "suspicious-refresh-reuse" });
  }

  // Bulk-enqueued in one Redis round-trip; the email worker's rate limiter (not
  // this method) is what keeps delivery under the SMTP provider's send rate.
  // One job per (content link, recipient): announcing the same content twice is ignored.
  sendNewContentEmails(recipients: string[], content: { kind: "blog" | "resource"; title: string; link: string }) {
    return this.emailQueue.addBulk(
      recipients.map((to) => ({
        name: "send",
        data: { to, template: { name: "new-content" as const, ...content } },
        opts: { ...this.jobOptions(), jobId: idempotencyJobId("new-content", content.kind, content.link, to.toLowerCase()) },
      })),
    );
  }

  private verificationLink(token: string) {
    return `${frontendUrl(this.config)}/verify-email?token=${token}`;
  }

  // QUEUE_BACKOFF_MS (optional) overrides the retry base delay — used by tests.
  private jobOptions() {
    const base = Number(this.config.get("QUEUE_BACKOFF_MS"));
    return emailJobOptions(Number.isFinite(base) && base > 0 ? base : undefined);
  }

  // `idempotencyParts` (when given) become a deterministic job id, so enqueueing the
  // same logical email twice sends it once. Omit for notices that may legitimately repeat.
  private enqueue(to: string, template: EmailTemplate, idempotencyParts?: [string, ...string[]]) {
    const opts = this.jobOptions();
    if (idempotencyParts) opts.jobId = idempotencyJobId(...idempotencyParts);
    return this.emailQueue.add("send", { to, template }, opts);
  }
}
