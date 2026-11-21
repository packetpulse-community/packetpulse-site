import { Inject, Injectable, Logger } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type Redis from "ioredis";
import type { AdminFeatureFlag, FeatureFlagKey, PublicFeatureFlags } from "@packetpulse/types";
import { PrismaService } from "../../prisma/prisma.service";
import { REDIS_CLIENT } from "../../common/redis/redis.constants";
import { FEATURE_FLAGS, FLAG_BY_KEY, type FeatureFlagDefinition } from "./feature-flag.registry";
import { featureDisabledException } from "./feature-disabled.exception";

const SETTINGS_ID = "default";
// Overrides for every flag without its own SiteSettings column live in one Redis hash.
// INTERIM: the durable home is a feature_flags table (see the TASK-047 hand-over note); the
// store is the only thing that changes when it lands.
export const FLAG_HASH = "packetpulse:feature-flags";
// Read on hot paths (every forum post, every email decision), so cached in-process; a change
// invalidates this replica at once and others within the TTL, like the maintenance flag.
const CACHE_TTL_MS = 5_000;

interface Resolved {
  enabled: boolean;
  overridden: boolean;
  source: AdminFeatureFlag["source"];
  updatedAt: string | null;
  updatedBy: string | null;
}

@Injectable()
export class FeatureFlagsService {
  private readonly logger = new Logger(FeatureFlagsService.name);
  private cache: { values: Map<FeatureFlagKey, Resolved>; expiresAt: number } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  /** Current value of one flag. Unknown stores fail open to the default, never to "off". */
  async isEnabled(key: FeatureFlagKey): Promise<boolean> {
    return (await this.resolveAll()).get(key)?.enabled ?? FLAG_BY_KEY.get(key)!.defaultValue;
  }

  /** Throws the FEATURE_DISABLED error when the flag is off. For service-level checks. */
  async assertEnabled(key: FeatureFlagKey, label?: string): Promise<void> {
    if (!(await this.isEnabled(key))) throw featureDisabledException(key, label);
  }

  async publicFlags(): Promise<PublicFeatureFlags> {
    const all = await this.resolveAll();
    const flags: PublicFeatureFlags["flags"] = {};
    for (const def of FEATURE_FLAGS) if (def.public) flags[def.key] = all.get(def.key)!.enabled;
    return { flags };
  }

  async listAdmin(): Promise<AdminFeatureFlag[]> {
    const all = await this.resolveAll();
    return FEATURE_FLAGS.map((def) => {
      const r = all.get(def.key)!;
      return {
        key: def.key,
        description: def.description,
        defaultValue: def.defaultValue,
        enabled: r.enabled,
        overridden: r.overridden,
        public: def.public,
        changePermission: def.changePermission,
        source: r.source,
        updatedAt: r.updatedAt,
        updatedBy: r.updatedBy,
      };
    });
  }

  /** Value straight from the stores, bypassing the cache (used before a write). */
  async currentFresh(key: FeatureFlagKey): Promise<boolean> {
    this.invalidate();
    return this.isEnabled(key);
  }

  /** Writes one flag; the caller (admin service) audits it first, so a failed audit blocks the change. */
  async write(def: FeatureFlagDefinition, enabled: boolean, actorId: string, tx?: Prisma.TransactionClient): Promise<void> {
    if (def.siteSetting) {
      const db = tx ?? this.prisma;
      await db.siteSettings.upsert({
        where: { id: SETTINGS_ID },
        update: { [def.siteSetting]: enabled },
        create: { id: SETTINGS_ID, [def.siteSetting]: enabled },
      });
    } else {
      await this.redis.hset(FLAG_HASH, def.key, JSON.stringify({ enabled, at: new Date().toISOString(), by: actorId }));
    }
    this.invalidate();
  }

  invalidate() {
    this.cache = null;
  }

  private async resolveAll(): Promise<Map<FeatureFlagKey, Resolved>> {
    if (this.cache && this.cache.expiresAt > Date.now()) return this.cache.values;

    let overrides: Record<string, string> = {};
    try {
      overrides = await this.redis.hgetall(FLAG_HASH);
    } catch (err) {
      this.logger.warn(`Feature flag store unreachable, using defaults: ${(err as Error).message}`);
    }
    let settings: { registrationEnabled: boolean; updatedAt: Date } | null = null;
    try {
      settings = await this.prisma.siteSettings.findUnique({
        where: { id: SETTINGS_ID },
        select: { registrationEnabled: true, updatedAt: true },
      });
    } catch (err) {
      this.logger.warn(`Site settings unreadable for feature flags: ${(err as Error).message}`);
    }

    const values = new Map<FeatureFlagKey, Resolved>();
    for (const def of FEATURE_FLAGS) {
      if (def.siteSetting) {
        const enabled = settings ? settings[def.siteSetting] : def.defaultValue;
        values.set(def.key, {
          enabled,
          overridden: enabled !== def.defaultValue,
          source: "site_settings",
          updatedAt: settings && enabled !== def.defaultValue ? settings.updatedAt.toISOString() : null,
          updatedBy: null,
        });
        continue;
      }
      const raw = overrides[def.key];
      let parsed: { enabled?: unknown; at?: unknown; by?: unknown } | null = null;
      if (raw) {
        try {
          parsed = JSON.parse(raw);
        } catch {
          parsed = null;
        }
      }
      if (parsed && typeof parsed.enabled === "boolean") {
        values.set(def.key, {
          enabled: parsed.enabled,
          overridden: parsed.enabled !== def.defaultValue,
          source: "override",
          updatedAt: typeof parsed.at === "string" ? parsed.at : null,
          updatedBy: typeof parsed.by === "string" ? parsed.by : null,
        });
      } else {
        values.set(def.key, { enabled: def.defaultValue, overridden: false, source: "default", updatedAt: null, updatedBy: null });
      }
    }
    this.cache = { values, expiresAt: Date.now() + CACHE_TTL_MS };
    return values;
  }
}
