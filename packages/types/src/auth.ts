import { z } from "zod";

// Matches the Prisma ProfessionalExperience enum exactly (apps/backend/prisma/schema.prisma).
export const ProfessionalExperienceSchema = z.enum(["student", "junior", "mid", "senior", "lead"]);

export const RegisterSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8).regex(/\d/, "must contain a number").regex(/[^A-Za-z0-9]/, "must contain a special character"),
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

export const VerifyOtpSchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6),
});

export const ResetPasswordSchema = z.object({
  tempToken: z.string().min(1),
  password: z.string().min(8),
});

export const VerifyEmailSchema = z.object({
  token: z.string().min(1),
});
