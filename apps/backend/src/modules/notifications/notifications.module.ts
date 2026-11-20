import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { NotificationsController } from "./presentation/controllers/notifications.controller";
import { NotificationsService } from "./application/services/notifications.service";
import { EmailQueueService } from "./application/services/email-queue.service";
import { ContentAnnouncementService } from "./application/services/content-announcement.service";
import { NotificationDispatcher } from "./application/services/notification-dispatcher.service";
import { MailerService } from "./infrastructure/email/mailer.service";
import { EmailProcessor } from "./infrastructure/queue/email.processor";
import { FanoutProcessor } from "./infrastructure/queue/fanout.processor";

@Module({
  imports: [BullModule.registerQueue({ name: "email" }, { name: "fanout" })],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    EmailQueueService,
    ContentAnnouncementService,
    NotificationDispatcher,
    MailerService,
    EmailProcessor,
    FanoutProcessor,
  ],
  exports: [NotificationsService, EmailQueueService, ContentAnnouncementService, NotificationDispatcher],
})
export class NotificationsModule {}
