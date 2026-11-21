import { SetMetadata } from "@nestjs/common";

// TASK-046: an account waiting out its deletion grace period is deactivated. Every route refuses it
// (ApprovedGuard, reason ACCOUNT_DEACTIVATED) except the few that let the member see who they are,
// look at the pending request and cancel it. Opt-in, so a new route is closed by default.
export const ALLOW_DEACTIVATED_KEY = "allowDeactivated";
export const AllowDeactivated = () => SetMetadata(ALLOW_DEACTIVATED_KEY, true);
