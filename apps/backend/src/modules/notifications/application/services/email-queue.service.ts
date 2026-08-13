import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { EmailTemplate } from "../../infrastructure/email/templates";

export interface EmailJobData {
  to: string;
  template: EmailTemplate;
}

// Public API other modules depend on (identity, admin) — enqueues onto the `email`
// queue this module owns rather than sending synchronously, so email delivery never
// blocks the request thread (plan §5).
@Injectable()
export class EmailQueueService {
  constructor(@InjectQueue("email") private readonly emailQueue: Queue<EmailJobData>) {}

  sendVerificationEmail(to: string, token: string) {
    return this.enqueue(to, { name: "verification", token });
  }

  sendWelcomeEmail(to: string, firstName: string) {
    return this.enqueue(to, { name: "welcome", firstName });
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

  private enqueue(to: string, template: EmailTemplate) {
    return this.emailQueue.add("send", { to, template }, { attempts: 3, backoff: { type: "exponential", delay: 5000 } });
  }
}
