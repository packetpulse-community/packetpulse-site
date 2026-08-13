import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { MailerService } from "../email/mailer.service";
import { renderEmail } from "../email/templates";
import { EmailJobData } from "../../application/services/email-queue.service";

@Processor("email")
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
