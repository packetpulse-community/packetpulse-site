import { Body, Controller, Get, HttpCode, Post, Put, Req } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import { ConsentService } from "../../application/services/consent.service";
import { PublishConsentPolicyDto, UpdateConsentDto } from "../../application/dto/consent.dto";
// Deep imports on purpose: IdentityModule imports ConsentModule, so the identity barrel would be circular.
import { Public } from "../../../identity/presentation/decorators/public.decorator";
import { CurrentUser } from "../../../identity/presentation/decorators/current-user.decorator";
import { RequirePermission } from "../../../identity/presentation/decorators/require-permission.decorator";
import { SkipApproval } from "../../../identity/presentation/decorators/skip-approval.decorator";
import { SkipEmailVerification } from "../../../identity/presentation/decorators/skip-email-verification.decorator";
import { PERMISSIONS } from "../../../identity/domain/constants/permissions.constants";
import type { AccessTokenPayload } from "../../../identity/application/services/token.service";

const WRITE = { default: { limit: 60, ttl: 900_000 } };

@Controller("consent")
export class ConsentController {
  constructor(private readonly consent: ConsentService) {}

  // The current policy versions, shown on the registration form before there is an account.
  @Public()
  @Get("policies")
  policies() {
    return this.consent.policies();
  }

  // Open to accounts that are not yet approved or verified: a member must be able to see and
  // re-accept a changed policy (and see their own history) whatever stage the account is at.
  @SkipApproval()
  @SkipEmailVerification()
  @Get("mine")
  mine(@CurrentUser() user: AccessTokenPayload) {
    return this.consent.mine(user.sub);
  }

  @SkipApproval()
  @SkipEmailVerification()
  @Throttle(WRITE)
  @Put("mine")
  update(@CurrentUser() user: AccessTokenPayload, @Body() dto: UpdateConsentDto, @Req() req: Request) {
    return this.consent.change(user.sub, dto, req.ip);
  }
}

@Controller("admin/consent")
export class AdminConsentController {
  constructor(private readonly consent: ConsentService) {}

  @RequirePermission(PERMISSIONS.POLICIES_MANAGE)
  @Get("policies")
  list() {
    return this.consent.adminPolicies();
  }

  @RequirePermission(PERMISSIONS.POLICIES_MANAGE)
  @Throttle(WRITE)
  @Post("policies")
  @HttpCode(201)
  publish(@CurrentUser() user: AccessTokenPayload, @Body() dto: PublishConsentPolicyDto) {
    return this.consent.publish(user.sub, dto);
  }
}
