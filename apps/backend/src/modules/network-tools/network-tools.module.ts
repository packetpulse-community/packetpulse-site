import { Module } from "@nestjs/common";
import { NetworkToolsController } from "./presentation/controllers/network-tools.controller";
import { NetworkToolsService } from "./application/services/network-tools.service";

@Module({
  controllers: [NetworkToolsController],
  providers: [NetworkToolsService],
})
export class NetworkToolsModule {}
