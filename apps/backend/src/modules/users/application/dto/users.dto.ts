import { createZodDto } from "nestjs-zod";
import { UpdateProfileSchema, ChangePasswordSchema, DeleteAccountSchema } from "@packetpulse/types";

export class UpdateProfileDto extends createZodDto(UpdateProfileSchema) {}
export class ChangePasswordDto extends createZodDto(ChangePasswordSchema) {}
export class DeleteAccountDto extends createZodDto(DeleteAccountSchema) {}
