import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications";
import { AdminController } from "./presentation/controllers/admin.controller";
import { AdminUsersService } from "./application/services/admin-users.service";
import { AdminCleanDataService } from "./application/services/admin-clean-data.service";
import { AdminModerationService } from "./application/services/admin-moderation.service";
import { AdminAnalyticsService } from "./application/services/admin-analytics.service";

@Module({
  imports: [NotificationsModule],
  controllers: [AdminController],
  providers: [AdminUsersService, AdminCleanDataService, AdminModerationService, AdminAnalyticsService],
})
export class AdminModule {}
