import { Injectable, Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { ConfigService } from "@nestjs/config";
import { Job, Queue } from "bullmq";
import { randomUUID } from "node:crypto";
import { NotificationChannel, NotificationDeliveryStatus, Prisma } from "@prisma/client";
import {
  DeliveryReason,
  NOTIFICATION_POLICY_DEFAULTS,
  NotificationEventType,
  defaultChannelEnabled,
  eventMeta,
} from "@packetpulse/types";
import { PrismaService } from "../../../../prisma/prisma.service";
import { frontendUrl } from "../../../../common/config/frontend-url";
import { EmailTemplate } from "../../infrastructure/email/templates";
import { EMAIL_QUEUE, emailJobOptions, idempotencyJobId } from "../../infrastructure/queue/queue-config";
import { localDayStart, quietHoursState, summariseError } from "./notification-policy";
import type { EmailJobData } from "./email-queue.service";

export interface DispatchInput {
  userId: string;
  type: NotificationEventType;
  /** The in-app row, when one exists. */
  notificationId?: string;
  /** Marks this one message critical (e.g. an interview within 24 h) on top of the catalogue flag. */
  critical?: boolean;
  /**
   * The email to send when the policy says yes. Omit to use the generic event notice;
   * `false` = this event's email is sent by someone else (the legacy EmailQueueService
   * senders route through `dispatchEmail`), so do not decide it here.
   */
  email?: false;
  /** Test hook: the decision clock. */
  now?: Date;
}

export interface DeliveryDecision {
  channel: NotificationChannel;
  status: NotificationDeliveryStatus;
  reasonCode?: DeliveryReason;
  deliveryId: string;
  /** Set when the email was deferred by quiet hours. */
  deferredUntil?: Date;
  /** The queued email job, when one was created. */
  job?: Job<EmailJobData>;
}

// Events whose email is sent through the legacy EmailQueueService senders
// (sendApprovalNotice, sendRoleChangeNotice, sendSuspiciousRefreshReuseAlert), which call
// `dispatchEmail` themselves. The fan-out path must not send a second email for them.
const LEGACY_EMAIL_EVENTS = new Set<string>(["approval", "role_change", "security_alert"]);

interface Settings {
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  timezone: string;
  whatsappOptIn: boolean;
  whatsappNumber: string | null;
  whatsappNumberConfirmedAt: Date | null;
}

// The one place that decides, per notification and channel, whether to send now, defer or
// skip (PRD-041, Document 1 section 10.3), and writes a NotificationDelivery row for every
// decision. Policy numbers come from env with the Document 1 values as defaults, because the
// owner has not approved them yet (OPEN-04).
@Injectable()
export class NotificationDispatcher {
  private readonly logger = new Logger(NotificationDispatcher.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @InjectQueue(EMAIL_QUEUE) private readonly emailQueue: Queue<EmailJobData>,
  ) {}

  /** Effective policy numbers (env override or the Document 1 default). */
  policy() {
    const cap = Number(this.config.get("NOTIFY_DAILY_CAP"));
    return {
      dailyCap: Number.isInteger(cap) && cap > 0 ? cap : NOTIFICATION_POLICY_DEFAULTS.dailyCap,
      quietHoursStart: this.config.get<string>("NOTIFY_QUIET_START") || NOTIFICATION_POLICY_DEFAULTS.quietHoursStart,
      quietHoursEnd: this.config.get<string>("NOTIFY_QUIET_END") || NOTIFICATION_POLICY_DEFAULTS.quietHoursEnd,
      timezone: this.config.get<string>("NOTIFY_TIMEZONE") || NOTIFICATION_POLICY_DEFAULTS.timezone,
    };
  }

  /** No WhatsApp provider is integrated (OPEN-18): opted-in members are recorded as no_provider. */
  whatsappProviderConfigured() {
    return false;
  }

  // Decide every channel for one notification. Never throws for a policy outcome; a database
  // or queue failure propagates so the caller can log it.
  async dispatch(input: DispatchInput): Promise<DeliveryDecision[]> {
    const meta = eventMeta(input.type);
    if (!meta) throw new Error(`Unknown notification event type: ${input.type}`);
    const now = input.now ?? new Date();
    const critical = meta.critical || !!input.critical;
    const decisions: DeliveryDecision[] = [];

    // In-app is always on, for every event. The row exists because the caller saved it.
    decisions.push(
      await this.record({
        userId: input.userId,
        notificationId: input.notificationId,
        eventType: input.type,
        channel: "in_app",
        status: "delivered",
        critical,
        deliveredAt: now,
      }),
    );

    const [user, settings, prefs] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: input.userId }, select: { email: true, emailVerified: true } }),
      this.loadSettings(input.userId),
      this.prisma.notificationPreference.findMany({ where: { userId: input.userId, eventType: input.type } }),
    ]);
    if (!user) return decisions;
    const chosen = (channel: NotificationChannel) => prefs.find((p) => p.channel === channel)?.enabled;

    if (meta.channels.email.allowed && input.email !== false && !LEGACY_EMAIL_EVENTS.has(input.type)) {
      decisions.push(
        await this.decideEmail({
          userId: input.userId,
          type: input.type,
          notificationId: input.notificationId,
          critical,
          address: user.emailVerified ? user.email : null,
          preference: chosen("email"),
          template: this.eventNotice(input.type),
          settings,
          now,
        }),
      );
    }
    if (meta.channels.whatsapp.allowed) {
      decisions.push(
        await this.decideWhatsapp({
          userId: input.userId,
          type: input.type,
          notificationId: input.notificationId,
          critical,
          preference: chosen("whatsapp"),
          settings,
          now,
        }),
      );
    }
    return decisions;
  }

  // Used by the legacy EmailQueueService senders (approval, role change, security alert):
  // same policy and delivery row as `dispatch`, for an email that already has its template.
  // Returns the decision; `decision.job` is the queued email job (absent when skipped).
  async dispatchEmail(opts: {
    userId: string;
    type: NotificationEventType;
    to: string;
    template: EmailTemplate;
    critical?: boolean;
    now?: Date;
  }) {
    const meta = eventMeta(opts.type);
    const now = opts.now ?? new Date();
    const [settings, prefs] = await Promise.all([
      this.loadSettings(opts.userId),
      this.prisma.notificationPreference.findMany({ where: { userId: opts.userId, eventType: opts.type, channel: "email" } }),
    ]);
    const decision = await this.decideEmail({
      userId: opts.userId,
      type: opts.type,
      critical: !!meta?.critical || !!opts.critical,
      address: opts.to,
      preference: prefs[0]?.enabled,
      template: opts.template,
      settings,
      now,
    });
    return decision;
  }

  async findUserIdByEmail(email: string): Promise<string | null> {
    const u = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    return u?.id ?? null;
  }

  private eventNotice(type: string): EmailTemplate {
    const base = frontendUrl(this.config);
    return { name: "event-notice", eventType: type, link: `${base}/notifications`, settingsLink: `${base}/settings/notifications` };
  }

  private async loadSettings(userId: string): Promise<Settings> {
    const row = await this.prisma.notificationSettings.findUnique({ where: { userId } });
    const p = this.policy();
    return {
      quietHoursEnabled: row?.quietHoursEnabled ?? true,
      quietHoursStart: row?.quietHoursStart ?? p.quietHoursStart,
      quietHoursEnd: row?.quietHoursEnd ?? p.quietHoursEnd,
      timezone: row?.timezone ?? p.timezone,
      whatsappOptIn: row?.whatsappOptIn ?? false,
      whatsappNumber: row?.whatsappNumber ?? null,
      whatsappNumberConfirmedAt: row?.whatsappNumberConfirmedAt ?? null,
    };
  }

  private async decideEmail(a: {
    userId: string;
    type: NotificationEventType;
    notificationId?: string;
    critical: boolean;
    address: string | null;
    preference: boolean | undefined;
    template: EmailTemplate;
    settings: Settings;
    now: Date;
  }): Promise<DeliveryDecision> {
    const base = { userId: a.userId, notificationId: a.notificationId, eventType: a.type, channel: "email" as const, critical: a.critical };
    if (!a.address) return this.record({ ...base, status: "skipped", reasonCode: "no_address" });
    // Critical events cannot be switched off, whatever is stored.
    const enabled = a.critical ? true : (a.preference ?? defaultChannelEnabled(a.type, "email"));
    if (!enabled) return this.record({ ...base, status: "skipped", reasonCode: "preference_off" });

    const quiet = a.critical
      ? { inQuietHours: false as const }
      : quietHoursState(a.now, {
          enabled: a.settings.quietHoursEnabled,
          start: a.settings.quietHoursStart,
          end: a.settings.quietHoursEnd,
          timezone: a.settings.timezone,
        });

    // The cap check and the row insert share one transaction under a per-member advisory lock,
    // so two notifications processed at once cannot both take the last slot.
    const deliveryId = randomUUID();
    const outcome = await this.prisma.$transaction(async (tx) => {
      if (!a.critical) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${a.userId}))`;
        if ((await this.sentToday(tx, a.userId, a.settings.timezone, a.now)) >= this.policy().dailyCap) {
          await tx.notificationDelivery.create({
            data: { id: deliveryId, ...base, status: "skipped", reasonCode: "frequency_cap" },
          });
          return "capped" as const;
        }
      }
      await tx.notificationDelivery.create({
        data: {
          id: deliveryId,
          ...base,
          status: "queued",
          reasonCode: quiet.inQuietHours ? "quiet_hours" : null,
          scheduledFor: quiet.resumeAt ?? null,
        },
      });
      return "queued" as const;
    });
    if (outcome === "capped") return { channel: "email", status: "skipped", reasonCode: "frequency_cap", deliveryId };

    let job: Job<EmailJobData>;
    try {
      const backoff = Number(this.config.get("QUEUE_BACKOFF_MS"));
      const opts = emailJobOptions(Number.isFinite(backoff) && backoff > 0 ? backoff : undefined);
      // The job id derives from the delivery id: enqueueing the same decision twice runs once.
      opts.jobId = idempotencyJobId("notify-email", deliveryId);
      if (quiet.delayMs) opts.delay = quiet.delayMs;
      job = await this.emailQueue.add("send", { to: a.address, template: a.template, deliveryId }, opts);
    } catch (err) {
      await this.markFailed(deliveryId, 0, err);
      throw err;
    }
    return quiet.inQuietHours
      ? { channel: "email", status: "queued", reasonCode: "quiet_hours", deliveryId, deferredUntil: quiet.resumeAt, job }
      : { channel: "email", status: "queued", deliveryId, job };
  }

  private async decideWhatsapp(a: {
    userId: string;
    type: NotificationEventType;
    notificationId?: string;
    critical: boolean;
    preference: boolean | undefined;
    settings: Settings;
    now: Date;
  }): Promise<DeliveryDecision> {
    const base = { userId: a.userId, notificationId: a.notificationId, eventType: a.type, channel: "whatsapp" as const, critical: a.critical };
    const s = a.settings;
    // Explicit opt-in AND a confirmed number, even for critical events.
    if (!s.whatsappOptIn || !s.whatsappNumber || !s.whatsappNumberConfirmedAt) {
      return this.record({ ...base, status: "skipped", reasonCode: "opt_out" });
    }
    const enabled = a.preference ?? defaultChannelEnabled(a.type, "whatsapp");
    if (!enabled && !a.critical) return this.record({ ...base, status: "skipped", reasonCode: "preference_off" });
    // OPEN-18: no provider is integrated yet. The decision is recorded so it shows what would have been sent.
    if (!this.whatsappProviderConfigured()) return this.record({ ...base, status: "skipped", reasonCode: "no_provider" });
    // A provider integration will add the cap, quiet-hours deferral and send here, mirroring decideEmail.
    return this.record({ ...base, status: "skipped", reasonCode: "no_provider" });
  }

  // Outbound (email + WhatsApp) non-critical messages that count against today's cap.
  private sentToday(tx: Prisma.TransactionClient, userId: string, timezone: string, now: Date) {
    return tx.notificationDelivery.count({
      where: {
        userId,
        critical: false,
        channel: { in: ["email", "whatsapp"] },
        status: { in: ["queued", "sent", "delivered"] },
        createdAt: { gte: localDayStart(now, timezone) },
      },
    });
  }

  private async record(row: {
    userId: string;
    notificationId?: string;
    eventType: string;
    channel: NotificationChannel;
    status: NotificationDeliveryStatus;
    reasonCode?: DeliveryReason;
    critical: boolean;
    deliveredAt?: Date;
  }): Promise<DeliveryDecision> {
    const created = await this.prisma.notificationDelivery.create({
      data: {
        userId: row.userId,
        notificationId: row.notificationId ?? null,
        eventType: row.eventType,
        channel: row.channel,
        status: row.status,
        reasonCode: row.reasonCode ?? null,
        critical: row.critical,
        deliveredAt: row.deliveredAt ?? null,
      },
    });
    return { channel: row.channel, status: row.status, reasonCode: row.reasonCode, deliveryId: created.id };
  }

  // ---- called by EmailProcessor; never throw (a log failure must not resend or fail the email) ----

  async markSent(deliveryId: string | undefined, attempts: number) {
    if (!deliveryId) return;
    try {
      await this.prisma.notificationDelivery.updateMany({
        where: { id: deliveryId },
        data: { status: "sent", attempts, sentAt: new Date(), errorSummary: null },
      });
    } catch (err) {
      this.logger.warn(`Could not mark delivery sent: ${summariseError(err)}`);
    }
  }

  async markFailed(deliveryId: string | undefined, attempts: number, err: unknown) {
    if (!deliveryId) return;
    try {
      await this.prisma.notificationDelivery.updateMany({
        where: { id: deliveryId },
        data: { status: "failed", attempts, errorSummary: summariseError(err) },
      });
    } catch (e) {
      this.logger.warn(`Could not mark delivery failed: ${summariseError(e)}`);
    }
  }

  async markRetry(deliveryId: string | undefined, attempts: number, err: unknown) {
    if (!deliveryId) return;
    try {
      await this.prisma.notificationDelivery.updateMany({
        where: { id: deliveryId },
        data: { attempts, errorSummary: summariseError(err) },
      });
    } catch (e) {
      this.logger.warn(`Could not record delivery retry: ${summariseError(e)}`);
    }
  }
}
