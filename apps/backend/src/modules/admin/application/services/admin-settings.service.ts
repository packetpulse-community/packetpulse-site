import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service";
import { SiteStatusService } from "../../../../common/site-status/site-status.service";
import type { UpdateSiteSettingsDto } from "@packetpulse/types";
import { AdminActivityLogService } from "./admin-activity-log.service";

const SETTINGS_ID = "default";

// Belt and braces: no current setting is a secret, but if one is ever added its value
// must never land in the audit log.
const SECRET_KEY = /secret|password|token|api.?key|credential/i;

@Injectable()
export class AdminSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly siteStatus: SiteStatusService,
    private readonly activityLog: AdminActivityLogService,
  ) {}

  // Singleton row, upserted into existence on first read — avoids a separate
  // seed/migration-time insert just to guarantee the row exists.
  async get() {
    return this.prisma.siteSettings.upsert({
      where: { id: SETTINGS_ID },
      update: {},
      create: { id: SETTINGS_ID },
    });
  }

  async update(dto: UpdateSiteSettingsDto, actorId: string) {
    const { reason, ...values } = dto;
    const settings = await this.prisma.$transaction(async (tx) => {
      const before = await tx.siteSettings.findUnique({ where: { id: SETTINGS_ID } });
      const after = await tx.siteSettings.upsert({
        where: { id: SETTINGS_ID },
        update: values,
        create: { id: SETTINGS_ID, ...values },
      });
      const changes: Record<string, { old: unknown; new: unknown }> = {};
      for (const key of Object.keys(values) as (keyof typeof values)[]) {
        const oldValue = before ? (before as Record<string, unknown>)[key] : undefined;
        const newValue = (after as Record<string, unknown>)[key];
        if (oldValue === newValue) continue;
        changes[key] = SECRET_KEY.test(key) ? { old: "[redacted]", new: "[redacted]" } : { old: oldValue ?? null, new: newValue };
      }
      // A save that changes nothing is not a change: no entry.
      if (Object.keys(changes).length > 0) {
        await this.activityLog.log(
          actorId,
          "site_settings_changed",
          "site_settings",
          SETTINGS_ID,
          { changedKeys: Object.keys(changes), changes },
          reason,
          tx,
        );
      }
      return after;
    });
    // Maintenance on/off takes effect on this replica's very next request.
    this.siteStatus.invalidate();
    return settings;
  }
}
