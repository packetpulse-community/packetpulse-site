import { z } from "zod";
import { RegistrationConsentsSchema } from "./consent";
import { OptionalWhatsappNumberSchema } from "./whatsapp";

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

// Cloudflare Turnstile token (TASK-013). Optional: only sent, and only required by the
// backend, when bot protection is enabled.
const captchaToken = z.string().max(4096).optional();

export const RegisterSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email(),
  password: PasswordSchema,
  // PRD-006: optional; stored as E.164 (India is the default country).
  whatsappNumber: OptionalWhatsappNumberSchema,
  professionalExperience: ProfessionalExperienceSchema.optional(),
  // PRD-004: the member confirms they are 18 or older. Stored as a timestamped attestation; the
  // date of birth itself is collected in onboarding (PRD-003) under field protection.
  ageConfirmed: z.literal(true, { errorMap: () => ({ message: "Please confirm you are 18 or older" }) }),
  // What the member accepted, by policy version (TASK-025, PRD-010). Replaces the client-only
  // terms tick: the Terms and the Privacy Policy must be in the list.
  consents: RegistrationConsentsSchema,
  captchaToken,
});
export type RegisterDto = z.infer<typeof RegisterSchema>;

export const RegisterAdminSchema = RegisterSchema.extend({
  // Admin sign-up predates consent capture; an admin without records is asked at first sign-in.
  consents: RegistrationConsentsSchema.optional(),
  // Same reason: admins are created through the secret code, not the public form.
  ageConfirmed: z.literal(true).optional(),
  adminSecureCode: z.string().min(1),
});
export type RegisterAdminDto = z.infer<typeof RegisterAdminSchema>;

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  captchaToken,
});
export type LoginDto = z.infer<typeof LoginSchema>;

export const ForgotPasswordSchema = z.object({
  email: z.string().email(),
  captchaToken,
});
export type ForgotPasswordDto = z.infer<typeof ForgotPasswordSchema>;

export const VerifyOtpSchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6),
  captchaToken,
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
