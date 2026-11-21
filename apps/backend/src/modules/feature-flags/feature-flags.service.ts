import { Inject, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type Redis from "ioredis";
import type { AdminFeatureFlag, FeatureFlagKey, PublicFeatureFlags } from "@packetpulse/types";
import { PrismaService } from "../../prisma/prisma.service";
import { REDIS_CLIENT } from "../../common/redis/redis.constants";
import { FEATURE_FLAGS, FLAG_BY_KEY, type FeatureFlagDefinition } from "./feature-flag.registry";
import { featureDisabledException } from "./feature-disabled.exception";

const SETTINGS_ID = "default";
// Durable home: the feature_flags table (a row only for a switch someone changed). Redis is an
// optional shared cache of those rows (FLAG_CACHE_KEY) and nothing more: flushing it, or losing
// it, changes no flag. FLAG_HASH is the old interim store; its entries are imported once at start
// (importLegacyRedisFlags) and the hash is then deleted.
export const FLAG_HASH = "packetpulse:feature-flags";
export const FLAG_CACHE_KEY = "packetpulse:feature-flags:cache:v2";
const SHARED_CACHE_TTL_SECONDS = 60;

type StoredFlag = { key: string; enabled: boolean; updatedBy: string | null; updatedAt: string };
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
export class FeatureFlagsService implements OnModuleInit {
  private readonly logger = new Logger(FeatureFlagsService.name);
  private cache: { values: Map<FeatureFlagKey, Resolved>; expiresAt: number } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async onModuleInit() {
    await this.importLegacyRedisFlags();
  }

  /**
   * One-time move of the TASK-047 interim Redis overrides into the table. A row already in the
   * table wins (it is newer than anything in the old hash); the hash is deleted only after the
   * rows are in, so a failure here loses nothing and is retried at the next start.
   */
  async importLegacyRedisFlags(): Promise<number> {
    try {
      const legacy = await this.redis.hgetall(FLAG_HASH);
      const rows: { key: string; enabled: boolean; updatedBy: string | null }[] = [];
      for (const def of FEATURE_FLAGS) {
        if (def.siteSetting || !legacy[def.key]) continue;
        try {
          const parsed = JSON.parse(legacy[def.key]!) as { enabled?: unknown; by?: unknown };
          if (typeof parsed.enabled === "boolean") {
            rows.push({ key: def.key, enabled: parsed.enabled, updatedBy: typeof parsed.by === "string" ? parsed.by : null });
          }
        } catch {
          // an unreadable entry is dropped with the hash, as it was ignored before
        }
      }
      if (rows.length > 0) await this.prisma.featureFlag.createMany({ data: rows, skipDuplicates: true });
      if (Object.keys(legacy).length > 0) await this.redis.del(FLAG_HASH);
      if (rows.length > 0) this.invalidate();
      return rows.length;
    } catch (err) {
      this.logger.warn(`Legacy feature flags not imported (will retry at next start): ${(err as Error).message}`);
      return 0;
    }
  }

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
    const db = tx ?? this.prisma;
    if (def.siteSetting) {
      await db.siteSettings.upsert({
        where: { id: SETTINGS_ID },
        update: { [def.siteSetting]: enabled },
        create: { id: SETTINGS_ID, [def.siteSetting]: enabled },
      });
    } else {
      await db.featureFlag.upsert({
        where: { key: def.key },
        update: { enabled, updatedBy: actorId },
        create: { key: def.key, enabled, updatedBy: actorId },
      });
    }
    this.invalidate();
  }

  /** Drops this replica's copy at once and the shared Redis copy best-effort. Call after a commit. */
  invalidate() {
    this.cache = null;
    this.redis.del(FLAG_CACHE_KEY).catch(() => undefined);
  }

  /** Rows from the shared cache, else from the table (then cached). Redis trouble never changes the answer. */
  private async loadStored(): Promise<Map<string, StoredFlag>> {
    try {
      const cached = await this.redis.get(FLAG_CACHE_KEY);
      if (cached) return new Map((JSON.parse(cached) as StoredFlag[]).map((r) => [r.key, r]));
    } catch (err) {
      this.logger.warn(`Feature flag cache unreadable, reading the database: ${(err as Error).message}`);
    }
    const rows = await this.prisma.featureFlag.findMany();
    const stored: StoredFlag[] = rows.map((r) => ({ key: r.key, enabled: r.enabled, updatedBy: r.updatedBy, updatedAt: r.updatedAt.toISOString() }));
    this.redis.set(FLAG_CACHE_KEY, JSON.stringify(stored), "EX", SHARED_CACHE_TTL_SECONDS).catch(() => undefined);
    return new Map(stored.map((r) => [r.key, r]));
  }

  private async resolveAll(): Promise<Map<FeatureFlagKey, Resolved>> {
    if (this.cache && this.cache.expiresAt > Date.now()) return this.cache.values;

    let stored = new Map<string, StoredFlag>();
    try {
      stored = await this.loadStored();
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
      const row = stored.get(def.key);
      if (row) {
        values.set(def.key, {
          enabled: row.enabled,
          overridden: row.enabled !== def.defaultValue,
          source: "override",
          updatedAt: row.updatedAt,
          updatedBy: row.updatedBy,
        });
      } else {
        values.set(def.key, { enabled: def.defaultValue, overridden: false, source: "default", updatedAt: null, updatedBy: null });
      }
    }
    this.cache = { values, expiresAt: Date.now() + CACHE_TTL_MS };
    return values;
  }
}
