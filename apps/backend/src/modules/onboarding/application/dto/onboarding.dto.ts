import { createZodDto } from "nestjs-zod";
import { SaveOnboardingSchema } from "@packetpulse/types";

export class SaveOnboardingDto extends createZodDto(SaveOnboardingSchema) {}
