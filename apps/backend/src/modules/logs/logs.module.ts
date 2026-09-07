import { Module } from "@nestjs/common";
import { LogsController } from "./presentation/controllers/logs.controller";
import { LogsService } from "./application/services/logs.service";

@Module({
  controllers: [LogsController],
  providers: [LogsService],
})
export class LogsModule {}
