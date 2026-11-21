import { z } from "zod";

// TASK-021 / PRD-041 / DB-024 / API-038 / API-039: the notification service.
// Policy source: Document 1, section 10.3 (OPEN-04, owner approval pending). Every value below
// is a configuration DEFAULT: the backend may override the policy numbers from env, and the
// per-event defaults live in one table (NOTIFICATION_EVENTS) so changing one is a one-line edit.

export const NOTIFICATION_CHANNELS = ["in_app", "email", "whatsapp"] as const;
export const NotificationChannelSchema = z.enum(NOTIFICATION_CHANNELS);
export type NotificationChannel = z.infer<typeof NotificationChannelSchema>;

export const NOTIFICATION_EVENT_TYPES = [
  "forum_reply",
  "blog_comment",
  "approval",
  "role_change",
  "certificate_issued",
  "security_alert",
  // v2 events: in the catalogue so preferences and the settings screen are complete, but nothing
  // emits them yet (`emitted: false`). Their owning tasks (TASK-038, TASK-042, ...) start sending.
  "interview",
  "offer",
  "assessment_result",
  "badge_expiry",
  "billing",
] as const;
export const NotificationEventTypeSchema = z.enum(NOTIFICATION_EVENT_TYPES);
export type NotificationEventType = z.infer<typeof NotificationEventTypeSchema>;

export interface ChannelRule {
  /** The channel may be used for this event at all. */
  allowed: boolean;
  /** Default when the member has not chosen. WhatsApp is never on by default (opt-in only). */
  default: boolean;
}

export interface NotificationEventMeta {
  type: NotificationEventType;
  label: string;
  description: string;
  channels: Record<NotificationChannel, ChannelRule>;
  /**
   * Critical events pass quiet hours and the daily cap, and cannot be switched off.
   * `criticalCondition` documents events that are critical only in some cases (the sender
   * marks those with `critical: true` when the condition holds).
   */
  critical: boolean;
  criticalCondition?: string;
  /** false = a placeholder for a v2 event that nothing sends yet. */
  emitted: boolean;
}

const IN_APP: ChannelRule = { allowed: true, default: true };
const NO: ChannelRule = { allowed: false, default: false };
const email = (on: boolean): ChannelRule => ({ allowed: true, default: on });
const whatsapp: ChannelRule = { allowed: true, default: false };

export const NOTIFICATION_EVENTS: readonly NotificationEventMeta[] = [
  {
    type: "forum_reply",
    label: "Replies to your forum threads",
    description: "Someone answered a thread you started.",
    channels: { in_app: IN_APP, email: email(false), whatsapp: NO },
    critical: false,
    emitted: true,
  },
  {
    type: "blog_comment",
    label: "Comments on your blog posts",
    description: "Someone commented on a post you wrote.",
    channels: { in_app: IN_APP, email: email(false), whatsapp: NO },
    critical: false,
    emitted: true,
  },
  {
    type: "approval",
    label: "Account approval",
    description: "An admin approved or revoked your account.",
    channels: { in_app: IN_APP, email: email(true), whatsapp: NO },
    critical: false,
    emitted: true,
  },
  {
    type: "role_change",
    label: "Role changes",
    description: "Your account roles changed.",
    channels: { in_app: IN_APP, email: email(true), whatsapp: NO },
    critical: false,
    emitted: true,
  },
  {
    type: "certificate_issued",
    label: "Certificates issued",
    description: "You passed a quiz and a certificate was issued.",
    channels: { in_app: IN_APP, email: email(false), whatsapp: NO },
    critical: false,
    emitted: true,
  },
  {
    type: "security_alert",
    label: "Security alerts",
    description: "Suspicious sign-in or session activity on your account.",
    channels: { in_app: IN_APP, email: email(true), whatsapp: NO },
    critical: true,
    emitted: true,
  },
  {
    type: "interview",
    label: "Interviews",
    description: "Interview invitations, changes and reminders (24 hours and 1 hour before).",
    channels: { in_app: IN_APP, email: email(true), whatsapp },
    critical: false,
    criticalCondition: "interview starts within 24 hours",
    emitted: false,
  },
  {
    type: "offer",
    label: "Offers",
    description: "Offers made to you and offers that are about to expire.",
    channels: { in_app: IN_APP, email: email(true), whatsapp },
    critical: false,
    criticalCondition: "offer expires within 48 hours",
    emitted: false,
  },
  {
    type: "assessment_result",
    label: "Assessment results",
    description: "Results of assessments you took.",
    channels: { in_app: IN_APP, email: email(true), whatsapp: NO },
    critical: false,
    emitted: false,
  },
  {
    type: "badge_expiry",
    label: "Badge expiry reminders",
    description: "Reminders 60 and 14 days before a badge expires.",
    channels: { in_app: IN_APP, email: email(true), whatsapp: NO },
    critical: false,
    emitted: false,
  },
  {
    type: "billing",
    label: "Billing",
    description: "Invoices and payment notices.",
    channels: { in_app: IN_APP, email: email(true), whatsapp: NO },
    critical: false,
    emitted: false,
  },
];

export const eventMeta = (type: string): NotificationEventMeta | undefined =>
  NOTIFICATION_EVENTS.find((e) => e.type === type);

/** Default for one event and channel when the member has not chosen. */
export function defaultChannelEnabled(type: NotificationEventType, channel: NotificationChannel): boolean {
  const rule = eventMeta(type)?.channels[channel];
  return !!rule && rule.allowed && rule.default;
}

// Policy numbers (Document 1, 10.3). The backend reads overrides from env; these are the defaults.
export const NOTIFICATION_POLICY_DEFAULTS = {
  quietHoursStart: "21:00",
  quietHoursEnd: "08:00",
  timezone: "Asia/Kolkata",
  /** Non-critical email + WhatsApp messages per member per local day. In-app is not counted. */
  dailyCap: 3,
} as const;

/** Why a delivery was deferred or skipped (NotificationDelivery.reasonCode). */
export const DELIVERY_REASONS = [
  "quiet_hours", // deferred (status queued) until the window ends
  "preference_off",
  "frequency_cap",
  "no_provider", // WhatsApp: no provider configured
  "opt_out", // WhatsApp: no explicit opt-in or number not confirmed
  "no_address", // no verified email address on file
  "feature_off", // the notifications.email feature switch is off
] as const;
export type DeliveryReason = (typeof DELIVERY_REASONS)[number];

export const DELIVERY_STATUSES = ["queued", "sent", "delivered", "failed", "skipped"] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export const DIGEST_FREQUENCIES = ["off", "daily", "weekly"] as const;
export const DigestFrequencySchema = z.enum(DIGEST_FREQUENCIES);
export type DigestFrequency = z.infer<typeof DigestFrequencySchema>;

const TimeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour time, for example 21:00");

// E.164: + then 8 to 15 digits. The number is the member's own data; it is only ever returned to them.
export const WhatsappNumberSchema = z.string().trim().regex(/^\+[1-9]\d{7,14}$/, "Use international format, for example +919876543210");

const ChannelFlagsSchema = z
  .object({
    email: z.boolean().optional(),
    whatsapp: z.boolean().optional(),
  })
  .strict();

// PUT /notifications/preferences. Partial update: send only what changed. `in_app` is not
// accepted (always on). Critical events cannot be switched off: the API answers 400.
export const UpdateNotificationPreferencesSchema = z
  .object({
    events: z.record(NotificationEventTypeSchema, ChannelFlagsSchema).optional(),
    quietHoursEnabled: z.boolean().optional(),
    quietHoursStart: TimeOfDay.optional(),
    quietHoursEnd: TimeOfDay.optional(),
    digestFrequency: DigestFrequencySchema.optional(),
    marketingOptIn: z.boolean().optional(),
    whatsappOptIn: z.boolean().optional(),
  })
  .strict();
export type UpdateNotificationPreferencesInput = z.infer<typeof UpdateNotificationPreferencesSchema>;

// POST /notifications/whatsapp/confirm-number. Stub: records the request, sends nothing.
export const ConfirmWhatsappNumberSchema = z.object({ number: WhatsappNumberSchema }).strict();
export type ConfirmWhatsappNumberInput = z.infer<typeof ConfirmWhatsappNumberSchema>;

// GET /notifications?page=&pageSize=
export const NotificationListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});
export type NotificationListQuery = z.infer<typeof NotificationListQuerySchema>;

export interface NotificationPreferencesView {
  events: {
    type: NotificationEventType;
    label: string;
    description: string;
    critical: boolean;
    criticalCondition?: string;
    emitted: boolean;
    channels: Record<NotificationChannel, { allowed: boolean; enabled: boolean; locked: boolean }>;
  }[];
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  timezone: string;
  digestFrequency: DigestFrequency;
  marketingOptIn: boolean;
  whatsapp: {
    optIn: boolean;
    /** Masked: only the last 4 digits. */
    numberMasked: string | null;
    confirmationRequestedAt: string | null;
    confirmedAt: string | null;
    /** false while no provider is configured: opted-in members still receive nothing. */
    providerConfigured: boolean;
  };
  dailyCap: number;
}

export interface NotificationItem {
  id: string;
  type: NotificationEventType;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationListResponse {
  items: NotificationItem[];
  unreadCount: number;
  page: number;
  pageSize: number;
  total: number;
}
