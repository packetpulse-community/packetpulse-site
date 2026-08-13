import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import nodemailer, { Transporter } from "nodemailer";

// SMTP transport, consumed only by infrastructure/queue/email.processor.ts — actual
// sends now happen off the request thread via the `email` BullMQ queue (plan §5),
// moved here from identity (Phase 1 stopgap) once this module existed to own it.
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private transporter: Transporter | null = null;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>("SMTP_HOST");
    if (host) {
      this.transporter = nodemailer.createTransport({
        host,
        port: this.config.get<number>("SMTP_PORT") ?? 587,
        auth: {
          user: this.config.get<string>("SMTP_USER"),
          pass: this.config.get<string>("SMTP_PASSWORD"),
        },
      });
    }
  }

  async send(to: string, subject: string, text: string) {
    if (!this.transporter) {
      // No SMTP configured (e.g. local dev without a mail catcher) — log instead of
      // failing the job, since email delivery must never crash the queue worker.
      this.logger.log(`[dev email] to=${to} subject="${subject}"\n${text}`);
      return;
    }
    await this.transporter.sendMail({ from: "PacketPulse <no-reply@packetpulse.dev>", to, subject, text });
  }
}
