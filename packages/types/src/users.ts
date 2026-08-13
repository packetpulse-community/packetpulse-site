import { z } from "zod";

export const UpdateProfileSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  bio: z.string().max(2000).optional(),
  whatsappNumber: z.string().optional(),
});
export type UpdateProfileDto = z.infer<typeof UpdateProfileSchema>;

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).regex(/\d/, "must contain a number").regex(/[^A-Za-z0-9]/, "must contain a special character"),
});
export type ChangePasswordDto = z.infer<typeof ChangePasswordSchema>;

export const DeleteAccountSchema = z.object({
  password: z.string().min(1),
});
export type DeleteAccountDto = z.infer<typeof DeleteAccountSchema>;
