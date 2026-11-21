import { Injectable, Optional } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";
import { frontendUrl } from "../../../../common/config/frontend-url";
import type { NotificationEventType } from "@packetpulse/types";
import { NotificationDispatcher } from "./notification-dispatcher.service";
import { EmailTemplate } from "../../infrastructure/email/templates";

import { EMAIL_QUEUE, emailJobOptions, idempotencyJobId } from "../../infrastructure/queue/queue-config";

export interface EmailJobData {
  to: string;
  template: EmailTemplate;
  /** NotificationDelivery row to update when the send completes or finally fails (TASK-021). */
  deliveryId?: string;
}

// Public API other modules depend on (identity, admin) — enqueues onto the `email`
// queue this module owns rather than sending synchronously, so email delivery never
// blocks the request thread (plan §5).
@Injectable()
export class EmailQueueService {
  constructor(
    @InjectQueue(EMAIL_QUEUE) private readonly emailQueue: Queue<EmailJobData>,
    private readonly config: ConfigService,
    // Optional so the queue services still work in isolation (and in the queue tests): without
    // the dispatcher these senders enqueue directly, exactly as before TASK-021.
    @Optional() private readonly dispatcher?: NotificationDispatcher,
  ) {}

  sendVerificationEmail(to: string, token: string, code?: string) {
    return this.enqueue(to, { name: "verification", link: this.verificationLink(token), code }, ["verification", token]);
  }

  // The 6-digit code on its own (PRD-001), for registration under instant access and for resends.
  sendEmailCode(to: string, code: string) {
    return this.enqueue(to, { name: "email-code", code }, ["email-code", to.toLowerCase(), code]);
  }

  // Sent once, when an admin approves a new member — approval notice and the
  // email-verification link in a single message.
  sendApprovedVerificationEmail(to: string, token: string, code?: string) {
    return this.enqueue(to, { name: "approved-verify", link: this.verificationLink(token), code }, ["approved-verify", token]);
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

  // The three notices below are notifications, not account transactions, so they go through the
  // dispatcher (preferences, quiet hours, daily cap, delivery log). Verification, reset,
  // welcome and password-changed emails never do: they are security-critical and unchanged.
  sendApprovalNotice(to: string, approved: boolean) {
    return this.routed("approval", to, { name: "approval", approved });
  }

  sendRoleChangeNotice(to: string, roleNames: string[]) {
    return this.routed("role_change", to, { name: "role-change", roleNames });
  }

  sendPasswordChangedNotice(to: string) {
    return this.enqueue(to, { name: "password-changed" });
  }

  sendSuspiciousRefreshReuseAlert(to: string) {
    return this.routed("security_alert", to, { name: "suspicious-refresh-reuse" });
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

  // TASK-046 data-rights confirmations. With a member id they go through the dispatcher (critical
  // events: preferences and quiet hours cannot suppress them, and the delivery is logged). Without
  // one (the final "erased" notice, sent after the member's rows are gone) they are enqueued
  // directly. `key` makes a repeated call send once.
  async sendDataRightsNotice(
    to: string,
    template: Extract<EmailTemplate, { name: "data-rights-notice" }>,
    opts: { userId?: string; type?: NotificationEventType; key: string },
  ) {
    if (this.dispatcher && opts.userId && opts.type) {
      const decision = await this.dispatcher.dispatchEmail({ userId: opts.userId, type: opts.type, to, template, critical: true });
      return decision.job;
    }
    return this.enqueue(to, template, ["data-rights-notice", opts.key]);
  }

  // Resolves the member by address and lets the dispatcher decide. No dispatcher or no matching
  // member (an address that is not an account) = enqueue directly, as before.
  private async routed(type: NotificationEventType, to: string, template: EmailTemplate) {
    const userId = this.dispatcher ? await this.dispatcher.findUserIdByEmail(to) : null;
    if (!this.dispatcher || !userId) return this.enqueue(to, template);
    const decision = await this.dispatcher.dispatchEmail({ userId, type, to, template });
    return decision.job;
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
