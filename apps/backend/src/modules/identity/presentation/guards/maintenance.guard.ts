import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ALLOW_DURING_MAINTENANCE_KEY } from "../decorators/allow-during-maintenance.decorator";
import { SUPER_ADMIN_ROLE } from "../../domain/constants/permissions.constants";
import { AccessTokenPayload } from "../../application/services/token.service";
import { SiteStatusService } from "../../../../common/site-status/site-status.service";
import { maintenanceException } from "../../../../common/site-status/maintenance.constants";

// Runs right after JwtAuthGuard (so req.user is populated, including on @Public
// routes when a token is present). While maintenance mode is on, only admins get
// through — everyone else, signed in or not, gets a 503 the frontend turns into
// the maintenance page.
@Injectable()
export class MaintenanceGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly siteStatus: SiteStatusService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const allowed = this.reflector.getAllAndOverride<boolean>(ALLOW_DURING_MAINTENANCE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (allowed) return true;
    if (!(await this.siteStatus.isMaintenance())) return true;

    const user: AccessTokenPayload | undefined = context.switchToHttp().getRequest().user;
    if (user && (user.roles.includes(SUPER_ADMIN_ROLE) || user.roles.includes("admin"))) return true;

    throw maintenanceException();
  }
}
