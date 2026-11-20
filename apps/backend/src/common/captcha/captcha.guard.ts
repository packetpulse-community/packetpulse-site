import { BadRequestException, CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import type { Request } from "express";
import { CaptchaService } from "./captcha.service";

const CAPTCHA_FAILED = "We could not confirm you are human. Please try again.";

// Applied per route (register, login, forgotpassword, verifyotp) — never globally, so
// refresh and authenticated routes are unaffected. Runs before the validation pipe, so it
// reads the raw body. A no-op while Turnstile is disabled.
@Injectable()
export class CaptchaGuard implements CanActivate {
  constructor(private readonly captcha: CaptchaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!this.captcha.isEnabled()) return true;
    const req = context.switchToHttp().getRequest<Request>();
    const token = (req.body as { captchaToken?: unknown } | undefined)?.captchaToken;
    if (typeof token !== "string" || token.length === 0 || token.length > 4096) {
      throw new BadRequestException(CAPTCHA_FAILED);
    }
    if (!(await this.captcha.verify(token, req.ip))) throw new BadRequestException(CAPTCHA_FAILED);
    return true;
  }
}
