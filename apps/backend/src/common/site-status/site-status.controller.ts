import { Controller, Get } from "@nestjs/common";
import { SiteStatusService } from "./site-status.service";
import { Public, CurrentUser, AllowDuringMaintenance, SUPER_ADMIN_ROLE } from "../../modules/identity";
import type { AccessTokenPayload } from "../../modules/identity";

@Controller("site-status")
export class SiteStatusController {
  constructor(private readonly siteStatus: SiteStatusService) {}

  // Public probe the frontend uses to decide whether to show the maintenance page.
  // canBypass tells an admin's own browser it may keep using the site.
  @Public()
  @AllowDuringMaintenance()
  @Get()
  async get(@CurrentUser() user?: AccessTokenPayload) {
    const { maintenanceMode, siteName } = await this.siteStatus.get();
    const isAdmin = !!user && (user.roles.includes(SUPER_ADMIN_ROLE) || user.roles.includes("admin"));
    return { maintenanceMode, siteName, canBypass: isAdmin };
  }
}
