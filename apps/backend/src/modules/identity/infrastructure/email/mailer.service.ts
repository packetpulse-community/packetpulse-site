import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import nodemailer, { Transporter } from "nodemailer";

// Direct SMTP send for Phase 1 — superseded by a BullMQ-backed `email` queue owned by
// the notifications module in Phase 5 (plan §5). Kept as a thin, swappable service so
// that later change is a constructor-injection swap, not a call-site rewrite.
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
      // failing the request, since email delivery must never block auth flows.
      this.logger.log(`[dev email] to=${to} subject="${subject}"\n${text}`);
      return;
    }
    await this.transporter.sendMail({ from: "PacketPulse <no-reply@packetpulse.dev>", to, subject, text });
  }
}
