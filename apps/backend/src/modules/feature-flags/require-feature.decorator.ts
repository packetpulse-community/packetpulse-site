import { applyDecorators, CanActivate, ExecutionContext, Injectable, SetMetadata, UseGuards } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { FeatureFlagKey } from "@packetpulse/types";
import { FeatureFlagsService } from "./feature-flags.service";

export const REQUIRE_FEATURE_KEY = "requireFeature";

@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly flags: FeatureFlagsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const meta = this.reflector.getAllAndOverride<{ key: FeatureFlagKey; label?: string } | undefined>(REQUIRE_FEATURE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (meta) await this.flags.assertEnabled(meta.key, meta.label);
    return true;
  }
}

/**
 * Route guard for a switchable feature: the call fails with 403 / FEATURE_DISABLED while the
 * flag is off. Runs after the global guard chain, so signed-out and unauthorised callers
 * still get 401/403 first. `label` is the noun used in the message ("Forum posting").
 */
export const RequireFeature = (key: FeatureFlagKey, label?: string) =>
  applyDecorators(SetMetadata(REQUIRE_FEATURE_KEY, { key, label }), UseGuards(FeatureFlagGuard));
