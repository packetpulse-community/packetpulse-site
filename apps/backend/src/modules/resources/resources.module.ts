import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications";
import { ResourcesController } from "./presentation/controllers/resources.controller";
import { ResourcesService } from "./application/services/resources.service";

@Module({
  imports: [NotificationsModule],
  controllers: [ResourcesController],
  providers: [ResourcesService],
})
export class ResourcesModule {}
