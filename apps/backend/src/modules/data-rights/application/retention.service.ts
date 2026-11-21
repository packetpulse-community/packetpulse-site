import { Injectable } from "@nestjs/common";
import { DAY_MS, retentionDays } from "@packetpulse/types";
import { PrismaService } from "../../../prisma/prisma.service";
import { AdminActivityLogService } from "../../admin/application/services/admin-activity-log.service";

// The automated rows of RETENTION_RULES (packages/types/src/data-rights.ts), one delete each.
// `now` is a parameter so tests move the clock instead of waiting. Append-only tables (the audit
// log, the file access log, the reputation ledger) are never touched here; consent records are
// removed only for accounts erased more than three years ago. docs/ops/data-retention.md.
@Injectable()
export class RetentionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AdminActivityLogService,
  ) {}

  private before(now: Date, key: string) {
    return new Date(now.getTime() - retentionDays(key) * DAY_MS);
  }

  async run(now: Date): Promise<Record<string, number>> {
    const counts: Record<string, number> = {};

    const sessionCut = this.before(now, "refresh_tokens");
    counts.refresh_tokens = (
      await this.prisma.refreshToken.deleteMany({ where: { OR: [{ expiresAt: { lt: sessionCut } }, { revokedAt: { lt: sessionCut } }] } })
    ).count;

    const codeCut = this.before(now, "auth_codes");
    counts.auth_codes =
      (await this.prisma.passwordReset.deleteMany({ where: { expiresAt: { lt: codeCut } } })).count +
      (await this.prisma.emailVerification.deleteMany({ where: { expiresAt: { lt: codeCut } } })).count +
      (await this.prisma.emailVerificationCode.deleteMany({ where: { expiresAt: { lt: codeCut } } })).count;

    // Deliveries first: they point at notifications.
    counts.notification_deliveries = (
      await this.prisma.notificationDelivery.deleteMany({ where: { createdAt: { lt: this.before(now, "notification_deliveries") } } })
    ).count;
    counts.notifications = (await this.prisma.notification.deleteMany({ where: { createdAt: { lt: this.before(now, "notifications") } } })).count;

    counts.client_logs = (await this.prisma.clientLog.deleteMany({ where: { createdAt: { lt: this.before(now, "client_logs") } } })).count;

    // Proof of consent outlives the account by three years, then goes.
    counts.consent_after_erasure = (
      await this.prisma.consentRecord.deleteMany({ where: { user: { erasedAt: { lt: this.before(now, "consent_after_erasure") } } } })
    ).count;

    counts.data_requests = (
      await this.prisma.dataRequest.deleteMany({
        where: { status: { in: ["completed", "cancelled", "expired", "failed"] }, updatedAt: { lt: this.before(now, "data_requests") } },
      })
    ).count;

    if (Object.values(counts).some((n) => n > 0)) {
      await this.audit.log(null, "retention_cleanup_run", "retention", undefined, { at: now.toISOString(), deleted: counts });
    }
    return counts;
  }
}
