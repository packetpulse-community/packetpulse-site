import { Injectable, NotFoundException } from "@nestjs/common";
import type { AdminFeatureFlag, UpdateFeatureFlagDto } from "@packetpulse/types";
import { PrismaService } from "../../prisma/prisma.service";
import { AdminActivityLogService } from "../admin/application/services/admin-activity-log.service";
import { FLAG_BY_KEY } from "./feature-flag.registry";
import { FeatureFlagsService } from "./feature-flags.service";

@Injectable()
export class FeatureFlagsAdminService {
  constructor(
    private readonly flags: FeatureFlagsService,
    private readonly prisma: PrismaService,
    private readonly activityLog: AdminActivityLogService,
  ) {}

  list() {
    return this.flags.listAdmin();
  }

  async update(key: string, dto: UpdateFeatureFlagDto, actorId: string): Promise<AdminFeatureFlag> {
    const def = FLAG_BY_KEY.get(key as never);
    if (!def) throw new NotFoundException("That feature switch does not exist.");
    // One transaction so a SiteSettings-backed flag and its audit entry commit together. The
    // audit row is written before the value changes, so a failed audit leaves the flag as it was.
    await this.prisma.$transaction(async (tx) => {
      const before = await this.flags.currentFresh(def.key);
      // A change to the value it already has is not a change: no entry.
      if (before !== dto.enabled) {
        await this.activityLog.log(
          actorId,
          "site_settings_changed",
          "feature_flag",
          def.key,
          { feature: def.key, old: before, new: dto.enabled },
          dto.reason,
          tx,
        );
      }
      await this.flags.write(def, dto.enabled, actorId, tx);
    });
    this.flags.invalidate(); // after the commit, so no reader re-caches the old value in between
    return (await this.flags.listAdmin()).find((f) => f.key === def.key)!;
  }
}
