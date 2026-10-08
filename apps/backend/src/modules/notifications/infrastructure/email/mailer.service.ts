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
      const port = this.config.get<number>("SMTP_PORT") ?? 587;
      this.transporter = nodemailer.createTransport({
        host,
        port,
        // 465 is implicit TLS (handshake first); 587 starts plain and upgrades via STARTTLS.
        secure: port === 465,
        auth: {
          user: this.config.get<string>("SMTP_USER"),
          pass: this.config.get<string>("SMTP_PASSWORD"),
        },
      });
    }
  }

  async send(to: string, subject: string, text: string) {
    if (!this.transporter) {
      // Production without SMTP is a misconfiguration, not a dev convenience:
      // fail the job (EmailProcessor logs the reason) and never write the body —
      // it can hold a password-reset code or a verification link.
      if (this.config.get<string>("NODE_ENV") === "production") {
        throw new Error("SMTP is not configured (SMTP_HOST is unset) — email not sent");
      }
      // Local dev without a mail catcher — print the email instead.
      this.logger.log(`[dev email] to=${to} subject="${subject}"\n${text}`);
      return;
    }
    await this.transporter.sendMail({ from: "PacketPulse <no-reply@packetpulse.in>", to, subject, text });
  }
}
