import { Controller, Get } from "@nestjs/common";
import { PresenceService } from "../../application/services/presence.service";
import { RequirePermission, PERMISSIONS } from "../../../identity";

@Controller("realtime")
export class PresenceController {
  constructor(private readonly presence: PresenceService) {}

  @RequirePermission(PERMISSIONS.ADMIN_VIEW_ANALYTICS)
  @Get("presence")
  async presenceSummary() {
    return { onlineCount: await this.presence.onlineCount() };
  }
}
