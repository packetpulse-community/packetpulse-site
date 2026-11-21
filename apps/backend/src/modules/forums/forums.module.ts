import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications";
import { AdminModule } from "../admin";
import { ForumsController } from "./presentation/controllers/forums.controller";
import { ForumThreadsService } from "./application/services/forum-threads.service";
import { ForumGuidelinesService } from "./application/services/forum-guidelines.service";
import { ForumModerationService } from "./application/services/forum-moderation.service";
import { ForumReportsService } from "./application/services/forum-reports.service";
import { ForumReputationService } from "./application/services/forum-reputation.service";
import { ForumRepliesService } from "./application/services/forum-replies.service";

@Module({
  imports: [NotificationsModule, AdminModule],
  controllers: [ForumsController],
  providers: [
    ForumThreadsService,
    ForumRepliesService,
    ForumGuidelinesService,
    ForumModerationService,
    ForumReportsService,
    ForumReputationService,
  ],
})
export class ForumsModule {}
