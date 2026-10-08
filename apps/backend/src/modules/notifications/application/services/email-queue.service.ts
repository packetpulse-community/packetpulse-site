import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";
import { frontendUrl } from "../../../../common/config/frontend-url";
import { EmailTemplate } from "../../infrastructure/email/templates";

const EMAIL_JOB_OPTS = { attempts: 3, backoff: { type: "exponential", delay: 5000 }, removeOnComplete: 1000 };

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
    @InjectQueue("email") private readonly emailQueue: Queue<EmailJobData>,
    private readonly config: ConfigService,
  ) {}

  sendVerificationEmail(to: string, token: string) {
    return this.enqueue(to, { name: "verification", link: this.verificationLink(token) });
  }

  // Sent once, when an admin approves a new member — approval notice and the
  // email-verification link in a single message.
  sendApprovedVerificationEmail(to: string, token: string) {
    return this.enqueue(to, { name: "approved-verify", link: this.verificationLink(token) });
  }

  sendWelcomeEmail(to: string, firstName: string) {
    return this.enqueue(to, { name: "welcome", firstName, loginLink: `${frontendUrl(this.config)}/login` });
  }

  sendPasswordResetOtp(to: string, otp: string) {
    return this.enqueue(to, { name: "password-reset-otp", otp });
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
  sendNewContentEmails(recipients: string[], content: { kind: "blog" | "resource"; title: string; link: string }) {
    return this.emailQueue.addBulk(
      recipients.map((to) => ({
        name: "send",
        data: { to, template: { name: "new-content" as const, ...content } },
        opts: EMAIL_JOB_OPTS,
      })),
    );
  }

  private verificationLink(token: string) {
    return `${frontendUrl(this.config)}/verify-email?token=${token}`;
  }

  private enqueue(to: string, template: EmailTemplate) {
    return this.emailQueue.add("send", { to, template }, EMAIL_JOB_OPTS);
  }
}
