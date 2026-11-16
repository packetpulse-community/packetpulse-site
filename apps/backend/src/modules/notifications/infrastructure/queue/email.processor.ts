import { Logger } from "@nestjs/common";
import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Job, UnrecoverableError } from "bullmq";
import { MailDeliveryError, MailerService } from "../email/mailer.service";
import { renderEmail } from "../email/templates";
import { EmailJobData } from "../../application/services/email-queue.service";
import { EMAIL_QUEUE, STALL_SETTINGS } from "./queue-config";
import { handleJobFailed, handleJobStalled, handleWorkerError, recipientDomain } from "./queue-alerts";

const ADDRESS = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Resend's default limit is 2 requests/second — the limiter paces bulk sends
// (e.g. new-content announcements) instead of letting them fail with 429s.
@Processor(EMAIL_QUEUE, { limiter: { max: 2, duration: 1000 }, ...STALL_SETTINGS })
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(private readonly mailer: MailerService) {
    super();
  }

  async process(job: Job<EmailJobData>) {
    const { to, template } = job.data;
    // Errors that retrying cannot fix are UnrecoverableError: the job fails at once.
    if (typeof to !== "string" || !ADDRESS.test(to)) throw new UnrecoverableError("Invalid recipient address");
    let rendered: { subject: string; text: string };
    try {
      rendered = renderEmail(template);
    } catch (err) {
      throw new UnrecoverableError(`Template error: ${(err as Error).message}`);
    }
    try {
      await this.mailer.send(to, rendered.subject, rendered.text);
    } catch (err) {
      if (err instanceof MailDeliveryError && err.permanent) throw new UnrecoverableError(err.message);
      throw err;
    }
  }

  // Log recipient domain and job id only — never the address, body, code or link.
  @OnWorkerEvent("completed")
  onCompleted(job: Job<EmailJobData>) {
    this.logger.log(`Email sent: template=${job.data.template?.name} domain=${recipientDomain(job.data.to)} job=${job.id}`);
  }

  @OnWorkerEvent("failed")
  onFailed(job: Job<EmailJobData> | undefined, error: Error) {
    handleJobFailed(this.logger, EMAIL_QUEUE, job, error, {
      template: job?.data.template?.name,
      domain: recipientDomain(job?.data.to),
    });
  }

  @OnWorkerEvent("stalled")
  onStalled(jobId: string) {
    handleJobStalled(this.logger, EMAIL_QUEUE, jobId);
  }

  @OnWorkerEvent("error")
  onError(error: Error) {
    handleWorkerError(this.logger, EMAIL_QUEUE, error);
  }
}
