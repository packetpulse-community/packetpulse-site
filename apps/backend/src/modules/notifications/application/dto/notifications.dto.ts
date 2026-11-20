import { createZodDto } from "nestjs-zod";
import {
  ConfirmWhatsappNumberSchema,
  NotificationListQuerySchema,
  UpdateNotificationPreferencesSchema,
} from "@packetpulse/types";

export class NotificationListQueryDto extends createZodDto(NotificationListQuerySchema) {}
export class UpdateNotificationPreferencesDto extends createZodDto(UpdateNotificationPreferencesSchema) {}
export class ConfirmWhatsappNumberDto extends createZodDto(ConfirmWhatsappNumberSchema) {}
