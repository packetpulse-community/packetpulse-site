import { Module } from "@nestjs/common";
import { ResourcesController } from "./presentation/controllers/resources.controller";
import { ResourcesService } from "./application/services/resources.service";

@Module({
  controllers: [ResourcesController],
  providers: [ResourcesService],
})
export class ResourcesModule {}
