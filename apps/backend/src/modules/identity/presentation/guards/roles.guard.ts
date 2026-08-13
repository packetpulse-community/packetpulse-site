import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { REQUIRE_PERMISSION_KEY } from "../decorators/require-permission.decorator";
import { SUPER_ADMIN_ROLE } from "../../domain/constants/permissions.constants";
import { AccessTokenPayload } from "../../application/services/token.service";

// Checks permissions, not raw role names (see require-permission.decorator.ts).
// super_admin bypasses all checks — operationally necessary, someone must always be
// able to fix a misconfigured permission set (plan §4).
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const required = this.reflector.getAllAndOverride<string | undefined>(REQUIRE_PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;

    const user: AccessTokenPayload | undefined = context.switchToHttp().getRequest().user;
    if (!user) return false;
    if (user.roles.includes(SUPER_ADMIN_ROLE)) return true;
    if (user.permissions.includes(required)) return true;

    throw new ForbiddenException(`Missing required permission: ${required}`);
  }
}
