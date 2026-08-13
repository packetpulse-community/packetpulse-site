import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { NotificationsController } from "./presentation/controllers/notifications.controller";
import { NotificationsService } from "./application/services/notifications.service";
import { EmailQueueService } from "./application/services/email-queue.service";
import { MailerService } from "./infrastructure/email/mailer.service";
import { EmailProcessor } from "./infrastructure/queue/email.processor";
import { FanoutProcessor } from "./infrastructure/queue/fanout.processor";

@Module({
  imports: [BullModule.registerQueue({ name: "email" }, { name: "fanout" })],
  controllers: [NotificationsController],
  providers: [NotificationsService, EmailQueueService, MailerService, EmailProcessor, FanoutProcessor],
  exports: [NotificationsService, EmailQueueService],
})
export class NotificationsModule {}
