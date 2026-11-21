import { Body, Controller, Get, HttpCode, Post, Put } from "@nestjs/common";
import { OnboardingService } from "../../application/services/onboarding.service";
import { SaveOnboardingDto } from "../../application/dto/onboarding.dto";
import { CurrentUser } from "../../../identity";
import type { AccessTokenPayload } from "../../../identity";

// Own data only: every route reads the member from the access token, never from the URL or body.
@Controller("onboarding")
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  @Get()
  status(@CurrentUser() user: AccessTokenPayload) {
    return this.onboarding.status(user.sub);
  }

  @Put()
  save(@CurrentUser() user: AccessTokenPayload, @Body() dto: SaveOnboardingDto) {
    return this.onboarding.save(user.sub, dto);
  }

  @Post("complete")
  @HttpCode(200)
  complete(@CurrentUser() user: AccessTokenPayload) {
    return this.onboarding.complete(user.sub);
  }
}
