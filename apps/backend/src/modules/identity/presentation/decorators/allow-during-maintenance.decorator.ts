import { SetMetadata } from "@nestjs/common";

export const ALLOW_DURING_MAINTENANCE_KEY = "allowDuringMaintenance";
// Marks the few routes that must keep working for everyone while maintenance mode
// is on: health checks, the public site-status probe, and the auth endpoints an
// admin needs to sign in (login itself rejects non-admins — AuthService.login).
export const AllowDuringMaintenance = () => SetMetadata(ALLOW_DURING_MAINTENANCE_KEY, true);
