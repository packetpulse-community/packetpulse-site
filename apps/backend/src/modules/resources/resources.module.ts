import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications";
import { AdminModule } from "../admin";
import { ResourcesController } from "./presentation/controllers/resources.controller";
import { ResourcesService } from "./application/services/resources.service";

@Module({
  imports: [NotificationsModule, AdminModule],
  controllers: [ResourcesController],
  providers: [ResourcesService],
})
export class ResourcesModule {}
