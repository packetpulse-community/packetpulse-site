import { Body, Controller, Get, HttpCode, Post, Req, Res } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Request, Response } from "express";
import { AuthService } from "../../application/services/auth.service";
import { AuthCookieService } from "../../application/services/auth-cookie.service";
import { UserRepository } from "../../domain/repositories/user.repository";
import { toPublicUser } from "../../domain/entities/user.entity";
import { Public } from "../decorators/public.decorator";
import { CurrentUser } from "../decorators/current-user.decorator";
import {
  RegisterDto,
  LoginDto,
  ForgotPasswordDto,
  VerifyOtpDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from "../../application/dto/auth.dto";
import { AccessTokenPayload } from "../../application/services/token.service";

// auth-strict tier (plan §4): brute-force/credential-stuffing defense on the
// endpoints an attacker would actually target.
const AUTH_STRICT = { default: { limit: 5, ttl: 900_000 } };
const AUTH_REFRESH = { default: { limit: 20, ttl: 900_000 } };

@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly cookies: AuthCookieService,
    private readonly users: UserRepository,
  ) {}

  @Public()
  @Throttle(AUTH_STRICT)
  @Post("register")
  async register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Public()
  @Throttle(AUTH_STRICT)
  @Post("login")
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const publicUser = await this.auth.login(dto);
    const session = await this.auth.issueSession(publicUser.id, {
      userAgent: req.headers["user-agent"],
      ipAddress: req.ip,
    });
    this.cookies.setAuthCookies(res, session.accessToken, session.refreshToken);
    return { user: session.user };
  }

  @Public()
  @Throttle(AUTH_REFRESH)
  @Post("refresh")
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const raw = req.cookies?.refreshToken;
    const session = await this.auth.refreshSession(raw, {
      userAgent: req.headers["user-agent"],
      ipAddress: req.ip,
    });
    this.cookies.setAuthCookies(res, session.accessToken, session.refreshToken);
    return { user: session.user };
  }

  @Post("logout")
  @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.cookies?.refreshToken);
    this.cookies.clearAuthCookies(res);
    return { success: true };
  }

  @Get("me")
  async me(@CurrentUser() current: AccessTokenPayload) {
    const user = await this.users.findById(current.sub);
    return user ? toPublicUser(user) : null;
  }

  @Public()
  @Throttle(AUTH_STRICT)
  @Post("forgotpassword")
  @HttpCode(200)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.auth.forgotPassword(dto.email);
    return { success: true };
  }

  @Public()
  @Throttle(AUTH_STRICT)
  @Post("verifyotp")
  @HttpCode(200)
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.auth.verifyOtp(dto.email, dto.otp);
  }

  @Public()
  @Throttle(AUTH_STRICT)
  @Post("resetpassword")
  @HttpCode(200)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.auth.resetPassword(dto.tempToken, dto.password);
    return { success: true };
  }

  @Public()
  @Throttle(AUTH_STRICT)
  @Post("verify-email")
  @HttpCode(200)
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    await this.auth.verifyEmail(dto.token);
    return { success: true };
  }

  @Throttle(AUTH_STRICT)
  @Post("resend-verification")
  @HttpCode(200)
  async resendVerification(@CurrentUser() current: AccessTokenPayload) {
    const user = await this.users.findById(current.sub);
    if (user && !user.emailVerified) {
      await this.auth.sendVerificationEmail(user.id, user.email);
    }
    return { success: true };
  }
}
