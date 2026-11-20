import { BadRequestException, Injectable } from "@nestjs/common";
import { NotificationChannel, Prisma } from "@prisma/client";
import {
  NOTIFICATION_EVENTS,
  NotificationEventType,
  NotificationPreferencesView,
  UpdateNotificationPreferencesInput,
  defaultChannelEnabled,
  eventMeta,
} from "@packetpulse/types";
import { PrismaService } from "../../../../prisma/prisma.service";
import { NotificationDispatcher } from "./notification-dispatcher.service";

const maskNumber = (n: string | null) => (n ? `${"•".repeat(Math.max(0, n.length - 4))}${n.slice(-4)}` : null);

interface Change {
  field: string;
  from: unknown;
  to: unknown;
}

// The caller's own notification preferences (API-039, SCR-037). Every change is written to
// NotificationPreferenceChange with its time. Never returns or logs another member's data.
@Injectable()
export class NotificationPreferencesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dispatcher: NotificationDispatcher,
  ) {}

  async get(userId: string): Promise<NotificationPreferencesView> {
    const [settings, prefs] = await Promise.all([
      this.prisma.notificationSettings.findUnique({ where: { userId } }),
      this.prisma.notificationPreference.findMany({ where: { userId } }),
    ]);
    const policy = this.dispatcher.policy();
    const enabled = (type: NotificationEventType, channel: NotificationChannel) =>
      prefs.find((p) => p.eventType === type && p.channel === channel)?.enabled ?? defaultChannelEnabled(type, channel);
    return {
      events: NOTIFICATION_EVENTS.map((e) => ({
        type: e.type,
        label: e.label,
        description: e.description,
        critical: e.critical,
        criticalCondition: e.criticalCondition,
        emitted: e.emitted,
        channels: {
          // In-app is always on for every event; a critical event's email cannot be turned off.
          in_app: { allowed: true, enabled: true, locked: true },
          email: { allowed: e.channels.email.allowed, enabled: e.critical ? true : enabled(e.type, "email"), locked: e.critical },
          whatsapp: { allowed: e.channels.whatsapp.allowed, enabled: enabled(e.type, "whatsapp"), locked: false },
        },
      })),
      quietHoursEnabled: settings?.quietHoursEnabled ?? true,
      quietHoursStart: settings?.quietHoursStart ?? policy.quietHoursStart,
      quietHoursEnd: settings?.quietHoursEnd ?? policy.quietHoursEnd,
      timezone: settings?.timezone ?? policy.timezone,
      digestFrequency: settings?.digestFrequency ?? "off",
      marketingOptIn: settings?.marketingOptIn ?? false,
      whatsapp: {
        optIn: settings?.whatsappOptIn ?? false,
        numberMasked: maskNumber(settings?.whatsappNumber ?? null),
        confirmationRequestedAt: settings?.whatsappNumberRequestedAt?.toISOString() ?? null,
        confirmedAt: settings?.whatsappNumberConfirmedAt?.toISOString() ?? null,
        providerConfigured: this.dispatcher.whatsappProviderConfigured(),
      },
      dailyCap: policy.dailyCap,
    };
  }

  async update(userId: string, input: UpdateNotificationPreferencesInput): Promise<NotificationPreferencesView> {
    // Validate the whole request before writing anything.
    for (const [type, flags] of Object.entries(input.events ?? {})) {
      const meta = eventMeta(type)!;
      if (meta.critical && flags.email === false) {
        throw new BadRequestException(`${meta.label} are critical and cannot be switched off.`);
      }
      for (const channel of ["email", "whatsapp"] as const) {
        if (flags[channel] !== undefined && !meta.channels[channel].allowed) {
          throw new BadRequestException(`${meta.label} cannot be sent by ${channel}.`);
        }
      }
    }
    const current = await this.get(userId);
    const existing = await this.prisma.notificationSettings.findUnique({ where: { userId } });
    if (input.whatsappOptIn === true && !existing?.whatsappNumber) {
      throw new BadRequestException("Add and confirm a WhatsApp number before opting in.");
    }

    const changes: Change[] = [];
    const settingsData: Prisma.NotificationSettingsUncheckedUpdateInput = {};
    const track = <T>(field: string, from: T, to: T | undefined) => {
      if (to !== undefined && to !== from) changes.push({ field, from, to });
    };
    track("quietHoursEnabled", current.quietHoursEnabled, input.quietHoursEnabled);
    track("quietHoursStart", current.quietHoursStart, input.quietHoursStart);
    track("quietHoursEnd", current.quietHoursEnd, input.quietHoursEnd);
    track("digestFrequency", current.digestFrequency, input.digestFrequency);
    track("marketingOptIn", current.marketingOptIn, input.marketingOptIn);
    track("whatsappOptIn", current.whatsapp.optIn, input.whatsappOptIn);
    const now = new Date();
    if (input.quietHoursEnabled !== undefined) settingsData.quietHoursEnabled = input.quietHoursEnabled;
    if (input.quietHoursStart !== undefined) settingsData.quietHoursStart = input.quietHoursStart;
    if (input.quietHoursEnd !== undefined) settingsData.quietHoursEnd = input.quietHoursEnd;
    if (input.digestFrequency !== undefined) settingsData.digestFrequency = input.digestFrequency;
    if (input.marketingOptIn !== undefined) {
      settingsData.marketingOptIn = input.marketingOptIn;
      if (input.marketingOptIn !== current.marketingOptIn) settingsData.marketingOptInAt = input.marketingOptIn ? now : null;
    }
    if (input.whatsappOptIn !== undefined) {
      settingsData.whatsappOptIn = input.whatsappOptIn;
      if (input.whatsappOptIn !== current.whatsapp.optIn) settingsData.whatsappOptInAt = input.whatsappOptIn ? now : null;
    }

    const prefWrites: { eventType: string; channel: NotificationChannel; enabled: boolean }[] = [];
    for (const [type, flags] of Object.entries(input.events ?? {})) {
      const row = current.events.find((e) => e.type === type)!;
      for (const channel of ["email", "whatsapp"] as const) {
        const to = flags[channel];
        if (to === undefined) continue;
        prefWrites.push({ eventType: type, channel, enabled: to });
        track(`${type}.${channel}`, row.channels[channel].enabled, to);
      }
    }

    const p = this.dispatcher.policy();
    await this.prisma.$transaction(async (tx) => {
      await tx.notificationSettings.upsert({
        where: { userId },
        update: settingsData,
        create: {
          userId,
          quietHoursStart: p.quietHoursStart,
          quietHoursEnd: p.quietHoursEnd,
          timezone: p.timezone,
          ...(settingsData as Omit<Prisma.NotificationSettingsUncheckedCreateInput, "userId">),
        },
      });
      for (const w of prefWrites) {
        await tx.notificationPreference.upsert({
          where: { userId_eventType_channel: { userId, eventType: w.eventType, channel: w.channel } },
          update: { enabled: w.enabled },
          create: { userId, ...w },
        });
      }
      if (changes.length) {
        await tx.notificationPreferenceChange.create({ data: { userId, changes: changes as unknown as Prisma.InputJsonValue } });
      }
    });
    return this.get(userId);
  }

  // Stub (API-039): records that the member asked to confirm this number, sends nothing. Until a
  // WhatsApp provider is chosen (OPEN-18) the number cannot be confirmed, so it stays pending and
  // no WhatsApp message can be sent to it. The change log keeps the request time, not the number.
  async requestNumberConfirmation(userId: string, number: string) {
    const p = this.dispatcher.policy();
    const now = new Date();
    const row = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.notificationSettings.upsert({
        where: { userId },
        update: { whatsappNumber: number, whatsappNumberRequestedAt: now, whatsappNumberConfirmedAt: null },
        create: {
          userId,
          quietHoursStart: p.quietHoursStart,
          quietHoursEnd: p.quietHoursEnd,
          timezone: p.timezone,
          whatsappNumber: number,
          whatsappNumberRequestedAt: now,
        },
      });
      await tx.notificationPreferenceChange.create({
        data: { userId, changes: [{ field: "whatsappNumberConfirmationRequested", from: null, to: now.toISOString() }] },
      });
      return saved;
    });
    return {
      status: "pending" as const,
      numberMasked: maskNumber(row.whatsappNumber),
      requestedAt: now.toISOString(),
      providerConfigured: this.dispatcher.whatsappProviderConfigured(),
    };
  }
}
