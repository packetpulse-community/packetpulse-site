import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const VERIFY_TIMEOUT_MS = 5000;

// Verifies Cloudflare Turnstile tokens (TASK-013 bot protection). The secret key is
// the on/off switch: unset = disabled (dev, tests, and production until the owner opts
// in), set = every protected request must carry a valid token. Tokens are never logged.
// Tests replace this whole provider with a fake, so no test touches the network.
@Injectable()
export class CaptchaService implements OnModuleInit {
  private readonly logger = new Logger(CaptchaService.name);

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    if (!this.isEnabled() && this.config.get<string>("NODE_ENV") === "production") {
      this.logger.warn(
        "TURNSTILE_SECRET_KEY is not set — bot protection is DISABLED on register, login, forgot-password and verify-otp. See docs/ops/bot-protection.md.",
      );
    }
  }

  isEnabled(): boolean {
    return Boolean(this.config.get<string>("TURNSTILE_SECRET_KEY")?.trim());
  }

  /** True only when Turnstile confirms the token. Fails CLOSED if Turnstile cannot be reached. */
  async verify(token: string, ip?: string): Promise<boolean> {
    const secret = this.config.get<string>("TURNSTILE_SECRET_KEY")?.trim();
    if (!secret) return true;
    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.set("remoteip", ip);
    try {
      const res = await fetch(SITEVERIFY_URL, {
        method: "POST",
        body,
        signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
      });
      if (!res.ok) {
        this.logger.error(`Turnstile siteverify UNREACHABLE/ERROR (HTTP ${res.status}) — failing closed`);
        return false;
      }
      const data = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
      if (data.success !== true) {
        this.logger.warn(`Turnstile rejected a token (${(data["error-codes"] ?? []).join(",") || "no error codes"})`);
        return false;
      }
      return true;
    } catch (err) {
      this.logger.error(
        `Turnstile siteverify UNREACHABLE (${err instanceof Error ? err.name : "error"}) — failing closed, sign-ins are blocked until it recovers`,
      );
      return false;
    }
  }
}
