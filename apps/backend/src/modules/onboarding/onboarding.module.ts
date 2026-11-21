import { Module } from "@nestjs/common";
import { OnboardingController } from "./presentation/controllers/onboarding.controller";
import { OnboardingService } from "./application/services/onboarding.service";

@Module({ controllers: [OnboardingController], providers: [OnboardingService] })
export class OnboardingModule {}
