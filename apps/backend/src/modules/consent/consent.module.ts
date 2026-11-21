import { Module } from "@nestjs/common";
import { ConsentController, AdminConsentController } from "./presentation/controllers/consent.controller";
import { ConsentService } from "./application/services/consent.service";
import { AdminActivityLogService } from "../admin/application/services/admin-activity-log.service";

// Depends only on Prisma and Config (both global), so IdentityModule can import it to record
// consent at registration without a module cycle. AdminActivityLogService is provided here for the
// same reason IdentityModule provides its own copy: AdminModule imports IdentityModule.
@Module({
  controllers: [ConsentController, AdminConsentController],
  providers: [ConsentService, AdminActivityLogService],
  exports: [ConsentService],
})
export class ConsentModule {}
