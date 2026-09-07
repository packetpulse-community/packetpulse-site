import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications";
import { AdminController } from "./presentation/controllers/admin.controller";
import { AdminUsersService } from "./application/services/admin-users.service";
import { AdminCleanDataService } from "./application/services/admin-clean-data.service";
import { AdminModerationService } from "./application/services/admin-moderation.service";
import { AdminAnalyticsService } from "./application/services/admin-analytics.service";
import { AdminActivityLogService } from "./application/services/admin-activity-log.service";
import { AdminSettingsService } from "./application/services/admin-settings.service";
import { AdminSystemStatusService } from "./application/services/admin-system-status.service";

@Module({
  imports: [NotificationsModule],
  controllers: [AdminController],
  providers: [
    AdminUsersService,
    AdminCleanDataService,
    AdminModerationService,
    AdminAnalyticsService,
    AdminActivityLogService,
    AdminSettingsService,
    AdminSystemStatusService,
  ],
})
export class AdminModule {}
