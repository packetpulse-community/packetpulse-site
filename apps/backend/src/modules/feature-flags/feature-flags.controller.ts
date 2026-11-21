import { Body, Controller, Get, Header, Param, Put } from "@nestjs/common";
import { createZodDto } from "nestjs-zod";
import { UpdateFeatureFlagSchema } from "@packetpulse/types";
import { AllowDuringMaintenance, CurrentUser, Public, RequirePermission, PERMISSIONS } from "../identity";
import type { AccessTokenPayload } from "../identity";
import { FeatureFlagsService } from "./feature-flags.service";
import { FeatureFlagsAdminService } from "./feature-flags-admin.service";

class UpdateFeatureFlagDto extends createZodDto(UpdateFeatureFlagSchema) {}

// What the web app may know: only flags marked public, as key -> on/off. Cached briefly at
// the edge and in the browser; the server-side value itself is cached for a few seconds.
@Controller("feature-flags")
export class FeatureFlagsController {
  constructor(private readonly flags: FeatureFlagsService) {}

  @Public()
  @AllowDuringMaintenance()
  @Header("Cache-Control", "public, max-age=15")
  @Get()
  get() {
    return this.flags.publicFlags();
  }
}

@Controller("admin/feature-flags")
export class AdminFeatureFlagsController {
  constructor(private readonly admin: FeatureFlagsAdminService) {}

  @RequirePermission(PERMISSIONS.ADMIN_MANAGE_SETTINGS)
  @Get()
  list() {
    return this.admin.list();
  }

  @RequirePermission(PERMISSIONS.ADMIN_MANAGE_SETTINGS)
  @Put(":key")
  update(@Param("key") key: string, @Body() dto: UpdateFeatureFlagDto, @CurrentUser() admin: AccessTokenPayload) {
    return this.admin.update(key, dto, admin.sub);
  }
}
