import { ForbiddenException } from "@nestjs/common";
import type { FeatureFlagKey } from "@packetpulse/types";

// 403 with a stable body the filter turns into code FEATURE_DISABLED (plus `feature`). Not
// 503: nothing is broken, a switch is off, and it must not be mistaken for maintenance.
export function featureDisabledException(feature: FeatureFlagKey, label?: string) {
  return new ForbiddenException({
    statusCode: 403,
    message: `${label ?? "This feature"} is switched off right now. Please check back later.`,
    featureDisabled: true,
    feature,
  });
}
