import { z } from "zod";
import { PasswordSchema } from "./auth";
import { OptionalWhatsappNumberSchema } from "./whatsapp";

export const UpdateProfileSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  bio: z.string().max(2000).optional(),
  whatsappNumber: OptionalWhatsappNumberSchema,
});
export type UpdateProfileDto = z.infer<typeof UpdateProfileSchema>;

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: PasswordSchema,
});
export type ChangePasswordDto = z.infer<typeof ChangePasswordSchema>;

export const DeleteAccountSchema = z.object({
  password: z.string().min(1),
});
export type DeleteAccountDto = z.infer<typeof DeleteAccountSchema>;
