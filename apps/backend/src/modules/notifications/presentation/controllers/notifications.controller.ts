import { Body, Controller, Get, HttpCode, Param, Post, Put, Query } from "@nestjs/common";
import { NotificationsService } from "../../application/services/notifications.service";
import { NotificationPreferencesService } from "../../application/services/notification-preferences.service";
import {
  ConfirmWhatsappNumberDto,
  NotificationListQueryDto,
  UpdateNotificationPreferencesDto,
} from "../../application/dto/notifications.dto";
// Deep import (not the identity/index.ts barrel) deliberately: identity.module.ts
// imports NotificationsModule (for EmailQueueService), so importing via identity's
// barrel here would create a circular require through both modules' index.ts files
// — CurrentUser would be undefined at decoration time when this file loads first
// in that cycle. This is the one narrow exception to the barrel-only rule (plan §3),
// scoped specifically to the identity<->notifications relationship.
import { CurrentUser } from "../../../identity/presentation/decorators/current-user.decorator";
import type { AccessTokenPayload } from "../../../identity/application/services/token.service";

@Controller("notifications")
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly preferences: NotificationPreferencesService,
  ) {}

  // Every route acts on the caller's own data only (user id from the token, never a parameter).
  @Get()
  list(@Query() query: NotificationListQueryDto, @CurrentUser() user: AccessTokenPayload) {
    return this.notifications.listMine(user.sub, query.page, query.pageSize);
  }

  @Put("read-all")
  @HttpCode(200)
  readAll(@CurrentUser() user: AccessTokenPayload) {
    return this.notifications.markAllRead(user.sub);
  }

  @Get("preferences")
  getPreferences(@CurrentUser() user: AccessTokenPayload) {
    return this.preferences.get(user.sub);
  }

  @Put("preferences")
  @HttpCode(200)
  updatePreferences(@Body() dto: UpdateNotificationPreferencesDto, @CurrentUser() user: AccessTokenPayload) {
    return this.preferences.update(user.sub, dto);
  }

  @Post("whatsapp/confirm-number")
  @HttpCode(200)
  confirmWhatsappNumber(@Body() dto: ConfirmWhatsappNumberDto, @CurrentUser() user: AccessTokenPayload) {
    return this.preferences.requestNumberConfirmation(user.sub, dto.number);
  }

  @Get("unread-count")
  async unreadCount(@CurrentUser() user: AccessTokenPayload) {
    return { count: await this.notifications.unreadCount(user.sub) };
  }

  @Put(":id/read")
  @HttpCode(200)
  async markRead(@Param("id") id: string, @CurrentUser() user: AccessTokenPayload) {
    await this.notifications.markRead(id, user.sub);
    return { success: true };
  }
}
