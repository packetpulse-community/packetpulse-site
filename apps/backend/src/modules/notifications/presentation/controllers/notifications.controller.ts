import { Controller, Get, HttpCode, Param, Put } from "@nestjs/common";
import { NotificationsService } from "../../application/services/notifications.service";
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
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: AccessTokenPayload) {
    return this.notifications.listMine(user.sub);
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
