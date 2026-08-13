import { SetMetadata } from "@nestjs/common";
import { PermissionKey } from "../../domain/constants/permissions.constants";

// Guards check against permissions, not raw role names — decouples "what a role is
// called" from "what it can do," so adding a role later never touches guard logic,
// only role_permissions seed data (plan §4).
export const REQUIRE_PERMISSION_KEY = "requirePermission";
export const RequirePermission = (permission: PermissionKey) => SetMetadata(REQUIRE_PERMISSION_KEY, permission);
