import { Global, Module } from "@nestjs/common";
import { AdminModule } from "../admin/admin.module";
import { FeatureFlagGuard } from "./require-feature.decorator";
import { FeatureFlagsService } from "./feature-flags.service";
import { FeatureFlagsAdminService } from "./feature-flags-admin.service";
import { AdminFeatureFlagsController, FeatureFlagsController } from "./feature-flags.controller";

// Global so any module's controller can use @RequireFeature and any service can inject
// FeatureFlagsService without importing this module (it imports AdminModule for the audit log).
@Global()
@Module({
  imports: [AdminModule],
  controllers: [FeatureFlagsController, AdminFeatureFlagsController],
  providers: [FeatureFlagsService, FeatureFlagsAdminService, FeatureFlagGuard],
  exports: [FeatureFlagsService, FeatureFlagGuard],
})
export class FeatureFlagsModule {}
