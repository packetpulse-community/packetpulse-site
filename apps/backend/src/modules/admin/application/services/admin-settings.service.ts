import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service";
import type { UpdateSiteSettingsDto } from "@packetpulse/types";

const SETTINGS_ID = "default";

@Injectable()
export class AdminSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  // Singleton row, upserted into existence on first read — avoids a separate
  // seed/migration-time insert just to guarantee the row exists.
  async get() {
    return this.prisma.siteSettings.upsert({
      where: { id: SETTINGS_ID },
      update: {},
      create: { id: SETTINGS_ID },
    });
  }

  async update(dto: UpdateSiteSettingsDto) {
    return this.prisma.siteSettings.upsert({
      where: { id: SETTINGS_ID },
      update: dto,
      create: { id: SETTINGS_ID, ...dto },
    });
  }
}
