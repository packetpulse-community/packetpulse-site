import { BadRequestException, ConflictException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ConsentPolicy, ConsentPurpose, ConsentRecord, ConsentSource, Prisma } from "@prisma/client";
import { createHmac } from "crypto";
import {
  AdminConsentPolicyRow,
  CONSENT_PURPOSES,
  CONSENT_PURPOSE_META,
  ConsentAcceptance,
  ConsentHistoryEntry,
  ConsentPolicyView,
  ConsentStatus,
  MyConsentItem,
  MyConsentView,
  PublishConsentPolicyInput,
  UpdateConsentInput,
} from "@packetpulse/types";
import { PrismaService } from "../../../../prisma/prisma.service";
import { AdminActivityLogService } from "../../../admin/application/services/admin-activity-log.service";

const HISTORY_LIMIT = 200;

export const toPolicyView = (p: ConsentPolicy): ConsentPolicyView => {
  const meta = CONSENT_PURPOSE_META[p.purpose];
  return {
    purpose: p.purpose,
    version: p.version,
    title: p.title,
    summary: p.summary,
    documentPath: meta.documentPath,
    effectiveAt: p.effectiveAt.toISOString(),
    label: meta.label,
    required: meta.required,
    withdrawable: meta.withdrawable,
  };
};

// Consent records and policy versions (TASK-025, PRD-010, DB-004, API-008, TEST-014). The history is
// append-only: nothing here updates or deletes a ConsentRecord. A member's current state for a
// purpose is simply their newest row.
@Injectable()
export class ConsentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AdminActivityLogService,
  ) {}

  /** Keyed hash of an IP: lets a dispute prove "same network" without storing the address. */
  hashIp(ip?: string | null): string | null {
    if (!ip) return null;
    const secret = this.config.get<string>("JWT_ACCESS_SECRET") ?? "";
    return createHmac("sha256", `consent-ip:${secret}`).update(ip).digest("hex").slice(0, 32);
  }

  /** The newest version of every policy. */
  async currentPolicies(db: Prisma.TransactionClient | PrismaService = this.prisma): Promise<Map<ConsentPurpose, ConsentPolicy>> {
    const rows = await db.consentPolicy.findMany({ orderBy: [{ purpose: "asc" }, { version: "desc" }], distinct: ["purpose"] });
    return new Map(rows.map((r) => [r.purpose, r]));
  }

  async policies(): Promise<ConsentPolicyView[]> {
    const current = await this.currentPolicies();
    return CONSENT_PURPOSES.filter((p) => current.has(p)).map((p) => toPolicyView(current.get(p)!));
  }

  /**
   * Registration accepts only what the page showed: every version named must be the current one.
   * Throws before the account is created so a stale form never leaves an account without consent.
   */
  async assertCurrent(accepted: readonly ConsentAcceptance[]): Promise<void> {
    const current = await this.currentPolicies();
    for (const a of accepted) {
      const policy = current.get(a.purpose);
      if (!policy) throw new BadRequestException(`There is no policy for ${a.purpose}`);
      if (policy.version !== a.policyVersion) {
        throw new ConflictException(
          `The ${CONSENT_PURPOSE_META[a.purpose].label} was updated. Reload the page, read the new version and accept it again.`,
        );
      }
    }
  }

  async recordRegistration(userId: string, accepted: readonly ConsentAcceptance[], ip?: string | null) {
    if (accepted.length === 0) return;
    const ipHash = this.hashIp(ip);
    await this.prisma.consentRecord.createMany({
      data: accepted.map((a) => ({
        userId,
        purpose: a.purpose,
        action: "granted" as const,
        policyVersion: a.policyVersion,
        source: "registration" as const,
        ipHash,
      })),
    });
  }

  private statusOf(latest: ConsentRecord | undefined): ConsentStatus {
    if (!latest) return "not_given";
    return latest.action === "granted" ? "granted" : "withdrawn";
  }

  async mine(userId: string): Promise<MyConsentView> {
    const [current, records] = await Promise.all([
      this.currentPolicies(),
      this.prisma.consentRecord.findMany({ where: { userId }, orderBy: [{ createdAt: "desc" }, { seq: "desc" }] }),
    ]);
    const latestBy = new Map<ConsentPurpose, ConsentRecord>();
    for (const r of records) if (!latestBy.has(r.purpose)) latestBy.set(r.purpose, r);

    const items: MyConsentItem[] = CONSENT_PURPOSES.filter((p) => current.has(p)).map((purpose) => {
      const meta = CONSENT_PURPOSE_META[purpose];
      const policy = current.get(purpose)!;
      const latest = latestBy.get(purpose);
      const status = this.statusOf(latest);
      const outdated = !!latest && latest.policyVersion < policy.version;
      return {
        purpose,
        label: meta.label,
        description: meta.description,
        required: meta.required,
        withdrawable: meta.withdrawable,
        policy: toPolicyView(policy),
        status,
        acceptedVersion: latest?.policyVersion ?? null,
        changedAt: latest?.createdAt.toISOString() ?? null,
        outdated,
        // A required consent must be granted at the latest version to keep using the product.
        needsAction: meta.required && (status !== "granted" || outdated),
      };
    });

    const history: ConsentHistoryEntry[] = records.slice(0, HISTORY_LIMIT).map((r) => ({
      id: r.id,
      purpose: r.purpose,
      label: CONSENT_PURPOSE_META[r.purpose].label,
      action: r.action,
      policyVersion: r.policyVersion,
      source: r.source,
      createdAt: r.createdAt.toISOString(),
    }));
    return { items, history, needsAction: items.some((i) => i.needsAction) };
  }

  /**
   * Grant or withdraw consents from the consent centre or the re-consent prompt. The whole request
   * is validated before anything is written. A change that matches the current state writes
   * nothing (so a double click never adds noise to the proof history).
   */
  async change(userId: string, input: UpdateConsentInput, ip?: string | null): Promise<MyConsentView> {
    const changes = input.changes;
    const source: ConsentSource = input.source === "recapture" ? "recapture" : "consent_centre";
    const seen = new Set<string>();
    for (const c of changes) {
      if (seen.has(c.purpose)) throw new BadRequestException(`${CONSENT_PURPOSE_META[c.purpose].label} appears twice in one request`);
      seen.add(c.purpose);
    }

    const before = await this.mine(userId);
    const byPurpose = new Map(before.items.map((i) => [i.purpose, i]));
    const writes: Prisma.ConsentRecordCreateManyInput[] = [];
    for (const c of changes) {
      const item = byPurpose.get(c.purpose);
      if (!item) throw new BadRequestException(`There is no policy for ${c.purpose}`);
      if (item.policy.version !== c.policyVersion) {
        throw new ConflictException(`The ${item.label} was updated. Reload to read the new version.`);
      }
      if (c.action === "withdrawn") {
        if (!item.withdrawable) {
          throw new BadRequestException(
            `${item.label} is needed to hold an account and cannot be withdrawn. To stop, delete your account from Profile settings.`,
          );
        }
        if (item.status !== "granted") continue; // already not given: nothing to record
      } else if (item.status === "granted" && !item.outdated) {
        continue; // already granted at this version
      }
      writes.push({ userId, purpose: c.purpose, action: c.action, policyVersion: c.policyVersion, source, ipHash: this.hashIp(ip) });
    }
    // Written one by one, in request order, so seq reflects the order of the decisions.
    if (writes.length > 0) await this.prisma.$transaction(writes.map((data) => this.prisma.consentRecord.create({ data })));
    return this.mine(userId);
  }

  // ---- super admin: policy versions (API-042) ------------------------------------------------------

  async adminPolicies(): Promise<AdminConsentPolicyRow[]> {
    const [policies, counts] = await Promise.all([
      this.prisma.consentPolicy.findMany({ orderBy: [{ purpose: "asc" }, { version: "desc" }] }),
      // Members whose newest decision on a purpose is "granted", grouped by the version granted.
      this.prisma.$queryRaw<{ purpose: ConsentPurpose; policy_version: number; n: bigint }[]>`
        SELECT purpose, policy_version, COUNT(*) AS n FROM (
          SELECT DISTINCT ON (user_id, purpose) purpose, policy_version, action
          FROM consent_records ORDER BY user_id, purpose, created_at DESC, seq DESC
        ) latest WHERE action = 'granted' GROUP BY purpose, policy_version`,
    ]);
    const countOf = (purpose: ConsentPurpose, version: number) =>
      Number(counts.find((c) => c.purpose === purpose && c.policy_version === version)?.n ?? 0);
    return policies.map((p) => ({
      ...toPolicyView(p),
      id: p.id,
      createdAt: p.createdAt.toISOString(),
      grantedCount: countOf(p.purpose, p.version),
    }));
  }

  /** Publishes the next version of a policy and writes the audit entry in the same transaction. */
  async publish(actorId: string, input: PublishConsentPolicyInput): Promise<ConsentPolicyView> {
    return this.prisma.$transaction(async (tx) => {
      const latest = await tx.consentPolicy.findFirst({ where: { purpose: input.purpose }, orderBy: { version: "desc" } });
      const policy = await tx.consentPolicy.create({
        data: {
          purpose: input.purpose,
          version: (latest?.version ?? 0) + 1,
          title: input.title,
          summary: input.summary,
          createdById: actorId,
        },
      });
      await this.audit.log(
        actorId,
        "consent_policy_published",
        "consent_policy",
        policy.id,
        { purpose: policy.purpose, version: policy.version, previousVersion: latest?.version ?? null, title: policy.title },
        input.reason,
        tx,
      );
      return toPolicyView(policy);
    });
  }
}
