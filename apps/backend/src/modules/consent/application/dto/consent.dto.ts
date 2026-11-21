import { createZodDto } from "nestjs-zod";
import { PublishConsentPolicySchema, UpdateConsentSchema } from "@packetpulse/types";

export class UpdateConsentDto extends createZodDto(UpdateConsentSchema) {}
export class PublishConsentPolicyDto extends createZodDto(PublishConsentPolicySchema) {}
