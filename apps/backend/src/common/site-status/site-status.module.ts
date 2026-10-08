import { Global, Module } from "@nestjs/common";
import { SiteStatusService } from "./site-status.service";
import { SiteStatusController } from "./site-status.controller";

// Global so MaintenanceGuard (identity), the login flow, and admin settings can all
// share one cached maintenance flag.
@Global()
@Module({
  controllers: [SiteStatusController],
  providers: [SiteStatusService],
  exports: [SiteStatusService],
})
export class SiteStatusModule {}
