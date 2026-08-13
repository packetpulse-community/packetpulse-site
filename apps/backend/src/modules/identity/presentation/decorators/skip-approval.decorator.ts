import { SetMetadata } from "@nestjs/common";

// Approval is orthogonal to role — most authenticated routes require it, so this is
// an opt-out rather than an opt-in (plan §4).
export const SKIP_APPROVAL_KEY = "skipApproval";
export const SkipApproval = () => SetMetadata(SKIP_APPROVAL_KEY, true);
