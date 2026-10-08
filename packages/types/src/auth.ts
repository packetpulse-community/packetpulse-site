import { z } from "zod";

// Single source of truth for new-password strength — the backend validates with
// PasswordSchema, and the frontend renders PASSWORD_RULES as a live checklist, so
// the two can never disagree about what a valid password is.
export const PASSWORD_RULES = [
  { id: "length", label: "At least 8 characters", pattern: /^.{8,}$/ },
  { id: "upper", label: "One uppercase letter (A–Z)", pattern: /[A-Z]/ },
  { id: "lower", label: "One lowercase letter (a–z)", pattern: /[a-z]/ },
  { id: "number", label: "One number (0–9)", pattern: /\d/ },
  { id: "special", label: "One special character (e.g. ! @ # $ %)", pattern: /[^A-Za-z0-9]/ },
] as const;

export const PasswordSchema = PASSWORD_RULES.reduce(
  (schema, rule) => schema.regex(rule.pattern, `Password needs ${rule.label.charAt(0).toLowerCase()}${rule.label.slice(1)}`),
  z.string().max(128, "Password must be at most 128 characters"),
);

// Matches the Prisma ProfessionalExperience enum exactly (apps/backend/prisma/schema.prisma).
export const ProfessionalExperienceSchema = z.enum(["student", "junior", "mid", "senior", "lead"]);

export const RegisterSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email(),
  password: PasswordSchema,
  whatsappNumber: z.string().optional(),
  professionalExperience: ProfessionalExperienceSchema.optional(),
});
export type RegisterDto = z.infer<typeof RegisterSchema>;

export const RegisterAdminSchema = RegisterSchema.extend({
  adminSecureCode: z.string().min(1),
});
export type RegisterAdminDto = z.infer<typeof RegisterAdminSchema>;

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginDto = z.infer<typeof LoginSchema>;

export const ForgotPasswordSchema = z.object({
  email: z.string().email(),
});
export type ForgotPasswordDto = z.infer<typeof ForgotPasswordSchema>;

export const VerifyOtpSchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6),
});
export type VerifyOtpDto = z.infer<typeof VerifyOtpSchema>;

export const ResetPasswordSchema = z.object({
  tempToken: z.string().min(1),
  password: PasswordSchema,
});
export type ResetPasswordDto = z.infer<typeof ResetPasswordSchema>;

export const VerifyEmailSchema = z.object({
  token: z.string().min(1),
});
