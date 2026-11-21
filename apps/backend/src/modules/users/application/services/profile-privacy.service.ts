import { Injectable } from "@nestjs/common";
import {
  ALWAYS_PRIVATE_PROFILE_FIELDS,
  PROFILE_PRIVACY_FIELDS,
  ProfilePrivacyField,
  ProfilePrivacyView,
  ProfileVisibilityLevel,
  UpdateProfilePrivacyInput,
} from "@packetpulse/types";
import { PrismaService } from "../../../../prisma/prisma.service";

// The member's own visibility choices (TASK-025, DEC-015, PRD-052). Every field defaults to
// private; the row is created the first time a member changes something.
@Injectable()
export class ProfilePrivacyService {
  constructor(private readonly prisma: PrismaService) {}

  /** The raw settings for any member (used by the members endpoint to decide what to open up). */
  async settingsFor(userId: string): Promise<Record<ProfilePrivacyField, ProfileVisibilityLevel>> {
    const row = await this.prisma.profilePrivacy.findUnique({ where: { userId } });
    return Object.fromEntries(PROFILE_PRIVACY_FIELDS.map((f) => [f, row?.[f] ?? "private"])) as Record<
      ProfilePrivacyField,
      ProfileVisibilityLevel
    >;
  }

  async get(userId: string): Promise<ProfilePrivacyView> {
    const row = await this.prisma.profilePrivacy.findUnique({ where: { userId } });
    return {
      settings: await this.settingsFor(userId),
      alwaysPrivate: [...ALWAYS_PRIVATE_PROFILE_FIELDS],
      updatedAt: row?.updatedAt.toISOString() ?? null,
    };
  }

  async update(userId: string, input: UpdateProfilePrivacyInput): Promise<ProfilePrivacyView> {
    await this.prisma.profilePrivacy.upsert({ where: { userId }, create: { userId, ...input }, update: input });
    return this.get(userId);
  }
}
