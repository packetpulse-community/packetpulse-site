import { createZodDto } from "nestjs-zod";
import {
  RegisterSchema,
  LoginSchema,
  ForgotPasswordSchema,
  VerifyOtpSchema,
  ResetPasswordSchema,
  VerifyEmailSchema,
} from "@packetpulse/types";

// Wraps the shared Zod schemas (single source of truth, also used by the frontend
// forms) as NestJS DTOs — validated via nestjs-zod's ZodValidationPipe (plan §1/§3).
export class RegisterDto extends createZodDto(RegisterSchema) {}
export class LoginDto extends createZodDto(LoginSchema) {}
export class ForgotPasswordDto extends createZodDto(ForgotPasswordSchema) {}
export class VerifyOtpDto extends createZodDto(VerifyOtpSchema) {}
export class ResetPasswordDto extends createZodDto(ResetPasswordSchema) {}
export class VerifyEmailDto extends createZodDto(VerifyEmailSchema) {}
