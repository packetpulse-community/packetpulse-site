import { Logger } from "@nestjs/common";
import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { MailerService } from "../email/mailer.service";
import { renderEmail } from "../email/templates";
import { EmailJobData } from "../../application/services/email-queue.service";

// Resend's default limit is 2 requests/second — the limiter paces bulk sends
// (e.g. new-content announcements) instead of letting them fail with 429s.
@Processor("email", { limiter: { max: 2, duration: 1000 } })
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(private readonly mailer: MailerService) {
    super();
  }

  async process(job: Job<EmailJobData>) {
    const { to, template } = job.data;
    const { subject, text } = renderEmail(template);
    await this.mailer.send(to, subject, text);
  }

  // Without these, BullMQ retries and finally drops a failed email silently —
  // nothing in the logs said whether a reset code was ever delivered.
  @OnWorkerEvent("completed")
  onCompleted(job: Job<EmailJobData>) {
    this.logger.log(`Email sent: template=${job.data.template.name} to=${job.data.to} job=${job.id}`);
  }

  @OnWorkerEvent("failed")
  onFailed(job: Job<EmailJobData> | undefined, error: Error) {
    if (!job) {
      this.logger.error(`Email job failed before it could be read: ${error.message}`);
      return;
    }
    const maxAttempts = job.opts.attempts ?? 1;
    const final = job.attemptsMade >= maxAttempts;
    const line =
      `Email ${final ? "FAILED permanently" : "failed, will retry"}: template=${job.data.template.name} ` +
      `to=${job.data.to} attempt=${job.attemptsMade}/${maxAttempts} job=${job.id} reason=${error.message}`;
    if (final) this.logger.error(line);
    else this.logger.warn(line);
  }
}
