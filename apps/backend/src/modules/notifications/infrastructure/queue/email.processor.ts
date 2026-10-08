import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { MailerService } from "../email/mailer.service";
import { renderEmail } from "../email/templates";
import { EmailJobData } from "../../application/services/email-queue.service";

// Resend's default limit is 2 requests/second — the limiter paces bulk sends
// (e.g. new-content announcements) instead of letting them fail with 429s.
@Processor("email", { limiter: { max: 2, duration: 1000 } })
export class EmailProcessor extends WorkerHost {
  constructor(private readonly mailer: MailerService) {
    super();
  }

  async process(job: Job<EmailJobData>) {
    const { to, template } = job.data;
    const { subject, text } = renderEmail(template);
    await this.mailer.send(to, subject, text);
  }
}
