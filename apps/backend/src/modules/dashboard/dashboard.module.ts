import { Module } from "@nestjs/common";
import { RealtimeModule } from "../realtime";
import { DashboardController } from "./presentation/controllers/dashboard.controller";
import { DashboardService } from "./application/services/dashboard.service";

@Module({
  imports: [RealtimeModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
