import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

const SETTINGS_ID = "default";
// The maintenance flag is read on every request by MaintenanceGuard, so it's cached
// in-process rather than queried each time. Toggling it in admin settings
// invalidates this replica's cache immediately; any other replica picks the change
// up within CACHE_TTL_MS.
const CACHE_TTL_MS = 10_000;

@Injectable()
export class SiteStatusService {
  private cached: { maintenanceMode: boolean; siteName: string; expiresAt: number } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async get() {
    if (this.cached && this.cached.expiresAt > Date.now()) return this.cached;
    const row = await this.prisma.siteSettings.findUnique({
      where: { id: SETTINGS_ID },
      select: { maintenanceMode: true, siteName: true },
    });
    this.cached = {
      maintenanceMode: row?.maintenanceMode ?? false,
      siteName: row?.siteName ?? "PacketPulse",
      expiresAt: Date.now() + CACHE_TTL_MS,
    };
    return this.cached;
  }

  async isMaintenance() {
    return (await this.get()).maintenanceMode;
  }

  invalidate() {
    this.cached = null;
  }
}
