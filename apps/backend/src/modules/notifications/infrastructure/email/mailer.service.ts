import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import nodemailer, { Transporter } from "nodemailer";

const FROM = "PacketPulse <no-reply@packetpulse.in>";
const RESEND_API_URL = "https://api.resend.com/emails";
const SEND_TIMEOUT_MS = 15_000;

// `permanent` = retrying cannot help (rejected address, malformed request); the email
// processor turns it into an UnrecoverableError so the job is not retried.
export class MailDeliveryError extends Error {
  constructor(
    message: string,
    readonly permanent: boolean,
  ) {
    super(message);
    this.name = "MailDeliveryError";
  }
}

// Email transport, consumed only by infrastructure/queue/email.processor.ts — actual
// sends happen off the request thread via the `email` BullMQ queue (plan §5).
//
// Picked once at boot:
// - RESEND_API_KEY set → Resend's HTTPS API (port 443). Preferred in production:
//   Render's free instances block outbound SMTP ports (25/465/587), which showed up
//   as "Connection timeout" on every send.
// - otherwise SMTP_HOST set → SMTP via nodemailer (any provider).
// - neither → dev console output (non-production only).
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private readonly resendApiKey: string | undefined;
  private transporter: Transporter | null = null;

  constructor(private readonly config: ConfigService) {
    this.resendApiKey = this.config.get<string>("RESEND_API_KEY") || undefined;
    const host = this.config.get<string>("SMTP_HOST");
    if (!this.resendApiKey && host) {
      const port = this.config.get<number>("SMTP_PORT") ?? 587;
      this.transporter = nodemailer.createTransport({
        host,
        port,
        // 465 is implicit TLS (handshake first); 587 starts plain and upgrades via STARTTLS.
        secure: port === 465,
        connectionTimeout: SEND_TIMEOUT_MS,
        auth: {
          user: this.config.get<string>("SMTP_USER"),
          pass: this.config.get<string>("SMTP_PASSWORD"),
        },
      });
    }
    const transport = this.resendApiKey ? "Resend HTTPS API" : this.transporter ? `SMTP (${host})` : "none";
    this.logger.log(`Email transport: ${transport}`);
  }

  async send(to: string, subject: string, text: string) {
    if (this.resendApiKey) return this.sendViaResendApi(to, subject, text);

    if (!this.transporter) {
      // Production without email config is a misconfiguration, not a dev convenience:
      // fail the job (EmailProcessor logs the reason) and never write the body —
      // it can hold a password-reset code or a verification link.
      if (this.config.get<string>("NODE_ENV") === "production") {
        throw new Error("Email is not configured (set RESEND_API_KEY or SMTP_HOST) — email not sent");
      }
      // Local dev without a mail catcher — print the email instead.
      this.logger.log(`[dev email] to=${to} subject="${subject}"\n${text}`);
      return;
    }
    try {
      await this.transporter.sendMail({ from: FROM, to, subject, text });
    } catch (err) {
      const code = (err as { responseCode?: number }).responseCode;
      // 5xx SMTP replies (bad mailbox, policy rejection) will not succeed on retry.
      throw new MailDeliveryError((err as Error).message, typeof code === "number" && code >= 500 && code < 600);
    }
  }

  private async sendViaResendApi(to: string, subject: string, text: string) {
    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [to], subject, text }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
    if (!res.ok) {
      // Resend's error body is { statusCode, name, message } — surfaced as the job's
      // failure reason so the log says exactly what was rejected.
      const body = (await res.json().catch(() => null)) as { name?: string; message?: string } | null;
      // 4xx other than 408/429 means the request itself was rejected — retrying repeats it.
      const permanent = res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429;
      throw new MailDeliveryError(
        `Resend API ${res.status}${body?.name ? ` ${body.name}` : ""}: ${body?.message ?? res.statusText}`,
        permanent,
      );
    }
  }
}
