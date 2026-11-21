import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { BullModule, getQueueToken } from "@nestjs/bullmq";
import { Test, TestingModule } from "@nestjs/testing";
import { Queue } from "bullmq";
import { randomUUID } from "node:crypto";
import { NOTIFICATION_EVENTS } from "@packetpulse/types";
import { EmailQueueService } from "../src/modules/notifications/application/services/email-queue.service";
import { NotificationDispatcher } from "../src/modules/notifications/application/services/notification-dispatcher.service";
import { NotificationsService } from "../src/modules/notifications/application/services/notifications.service";
import { MailerService } from "../src/modules/notifications/infrastructure/email/mailer.service";
import { EmailTemplate, renderEmail } from "../src/modules/notifications/infrastructure/email/templates";
import { EmailProcessor } from "../src/modules/notifications/infrastructure/queue/email.processor";
import { FanoutProcessor } from "../src/modules/notifications/infrastructure/queue/fanout.processor";
import { quietHoursState, localDayStart } from "../src/modules/notifications/application/services/notification-policy";
import { FeatureFlagsService } from "../src/modules/feature-flags/feature-flags.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { RealtimeEmitterService } from "../src/common/realtime/realtime-emitter.service";

// TEST-032 (TASK-021, PRD-041): notifications respect preferences, quiet hours and opt-in;
// critical events pass. Real database and Redis (isolated BullMQ prefix), mailer double.
jest.setTimeout(60_000);

const istToday = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
const IST_23H = () => new Date(`${istToday()}T23:00:00+05:30`); // inside quiet hours
const IST_NOON = () => new Date(`${istToday()}T12:00:00+05:30`);

describe("Notification dispatcher (e2e)", () => {
  const prefix = `test-notify-${randomUUID().slice(0, 8)}`;
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let dispatcher: NotificationDispatcher;
  let emails: EmailQueueService;
  let notifications: NotificationsService;
  let emailQueue: Queue;
  let fanoutQueue: Queue;
  const userIds: string[] = [];
  const sent: { to: string; subject: string; text: string }[] = [];
  const mailer = {
    async send(to: string, subject: string, text: string) {
      sent.push({ to, subject, text });
    },
  };

  async function newUser(over: { emailVerified?: boolean } = {}) {
    const u = await prisma.user.create({
      data: {
        firstName: "Notify",
        lastName: "Tester",
        email: `nd-${randomUUID()}@example.com`,
        emailVerified: over.emailVerified ?? true,
        isApproved: true,
      },
    });
    userIds.push(u.id);
    return u;
  }
  async function newNotification(userId: string) {
    return prisma.notification.create({ data: { userId, type: "forum_reply", payload: {} } });
  }
  const setPref = (userId: string, eventType: string, channel: "email" | "whatsapp", enabled: boolean) =>
    prisma.notificationPreference.upsert({
      where: { userId_eventType_channel: { userId, eventType, channel } },
      update: { enabled },
      create: { userId, eventType, channel, enabled },
    });
  const deliveries = (userId: string) => prisma.notificationDelivery.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
  const byChannel = (rows: Awaited<ReturnType<typeof deliveries>>, channel: string) => rows.filter((r) => r.channel === channel);
  async function waitFor(check: () => Promise<boolean> | boolean, ms = 15_000) {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (await check()) return;
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error("waitFor timed out");
  }

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        BullModule.forRoot({ connection: { url: process.env.REDIS_URL! }, prefix }),
        BullModule.registerQueue({ name: "email" }, { name: "fanout" }),
      ],
      providers: [
        PrismaService,
        EmailQueueService,
        NotificationsService,
        NotificationDispatcher,
        EmailProcessor,
        FanoutProcessor,
        { provide: FeatureFlagsService, useValue: { isEnabled: async () => true } },
        { provide: MailerService, useValue: mailer },
        { provide: RealtimeEmitterService, useValue: { emit: async () => undefined } },
        {
          provide: ConfigService,
          useValue: { get: (k: string) => ({ QUEUE_BACKOFF_MS: "50", FRONTEND_URL: "http://localhost:3000" })[k] },
        },
      ],
    }).compile();
    await moduleRef.init();
    prisma = moduleRef.get(PrismaService);
    dispatcher = moduleRef.get(NotificationDispatcher);
    emails = moduleRef.get(EmailQueueService);
    notifications = moduleRef.get(NotificationsService);
    emailQueue = moduleRef.get(getQueueToken("email"));
    fanoutQueue = moduleRef.get(getQueueToken("fanout"));
  });

  beforeEach(() => {
    sent.length = 0;
    jest.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  afterAll(async () => {
    // Deleting the users cascades to their settings, preferences, notifications and deliveries.
    if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await emailQueue.obliterate({ force: true });
    await fanoutQueue.obliterate({ force: true });
    await moduleRef.close();
  });

  describe("policy helpers", () => {
    const cfg = { enabled: true, start: "21:00", end: "08:00", timezone: "Asia/Kolkata" };
    it("detects the window across midnight and computes when it ends", () => {
      expect(quietHoursState(new Date("2026-11-21T12:00:00+05:30"), cfg).inQuietHours).toBe(false);
      expect(quietHoursState(new Date("2026-11-21T07:59:00+05:30"), cfg).inQuietHours).toBe(true);
      expect(quietHoursState(new Date("2026-11-21T08:00:00+05:30"), cfg).inQuietHours).toBe(false);
      const s = quietHoursState(new Date("2026-11-21T23:00:00+05:30"), cfg);
      expect(s.inQuietHours).toBe(true);
      expect(s.delayMs).toBeGreaterThan(9 * 3600_000 - 5000);
      expect(s.delayMs).toBeLessThan(9 * 3600_000 + 5000);
    });
    it("is never quiet when disabled or when start equals end", () => {
      expect(quietHoursState(new Date("2026-11-21T23:00:00+05:30"), { ...cfg, enabled: false }).inQuietHours).toBe(false);
      expect(quietHoursState(new Date("2026-11-21T23:00:00+05:30"), { ...cfg, end: "21:00" }).inQuietHours).toBe(false);
    });
    it("finds the start of the member's local day", () => {
      expect(localDayStart(new Date("2026-11-21T15:30:00+05:30"), "Asia/Kolkata").toISOString()).toBe("2026-11-20T18:30:00.000Z");
    });
  });

  it("in-app is always on and email follows the catalogue default and the preference", async () => {
    const u = await newUser();
    // forum_reply email defaults to off (community replies are digest material)
    const n1 = await newNotification(u.id);
    await dispatcher.dispatch({ userId: u.id, type: "forum_reply", notificationId: n1.id, now: IST_NOON() });
    let rows = await deliveries(u.id);
    expect(byChannel(rows, "in_app")).toHaveLength(1);
    expect(byChannel(rows, "in_app")[0]).toMatchObject({ status: "delivered", notificationId: n1.id });
    expect(byChannel(rows, "email")[0]).toMatchObject({ status: "skipped", reasonCode: "preference_off" });

    // switch email on: now it is queued and sent
    await setPref(u.id, "forum_reply", "email", true);
    const n2 = await newNotification(u.id);
    const [, email] = await dispatcher.dispatch({ userId: u.id, type: "forum_reply", notificationId: n2.id, now: IST_NOON() });
    expect(email).toMatchObject({ channel: "email", status: "queued" });
    await waitFor(() => sent.some((m) => m.to.startsWith("nd-")));
    await waitFor(async () => (await prisma.notificationDelivery.findUnique({ where: { id: email!.deliveryId } }))?.status === "sent");

    // switch it off again: skipped, in-app still delivered
    await setPref(u.id, "forum_reply", "email", false);
    const n3 = await newNotification(u.id);
    const out = await dispatcher.dispatch({ userId: u.id, type: "forum_reply", notificationId: n3.id, now: IST_NOON() });
    expect(out.map((d) => `${d.channel}:${d.status}`)).toEqual(["in_app:delivered", "email:skipped"]);
  });

  it("an approval email defaults on, and is skipped when the member switched it off", async () => {
    const u = await newUser();
    await setPref(u.id, "approval", "email", false);
    const job = await emails.sendApprovalNotice(u.email, true);
    expect(job).toBeUndefined();
    const rows = await deliveries(u.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ channel: "email", eventType: "approval", status: "skipped", reasonCode: "preference_off", notificationId: null });
  });

  it("critical events pass quiet hours at once and cannot be switched off", async () => {
    const u = await newUser();
    await setPref(u.id, "security_alert", "email", false); // ignored for a critical event
    const decisions = await dispatcher.dispatchEmail({
      userId: u.id,
      type: "security_alert",
      to: u.email,
      template: { name: "suspicious-refresh-reuse" },
      now: IST_23H(),
    });
    expect(decisions).toMatchObject({ channel: "email", status: "queued" });
    expect(decisions.reasonCode).toBeUndefined();
    expect(decisions.job).toBeDefined();
    expect(await decisions.job!.getState()).not.toBe("delayed");
    await waitFor(() => sent.length === 1);
    expect(sent[0]!.subject).toContain("Security alert");
    const row = (await deliveries(u.id))[0]!;
    expect(row.critical).toBe(true);
  });

  it("a message marked critical (an interview within 24 h) passes quiet hours too", async () => {
    const u = await newUser();
    const n = await newNotification(u.id);
    const out = await dispatcher.dispatch({ userId: u.id, type: "interview", notificationId: n.id, critical: true, now: IST_23H() });
    expect(out.find((d) => d.channel === "email")).toMatchObject({ status: "queued" });
    expect(out.find((d) => d.channel === "email")!.reasonCode).toBeUndefined();
    await waitFor(() => sent.length === 1);
  });

  it("non-critical email in quiet hours is deferred with a delayed job, then sent after the window", async () => {
    const u = await newUser();
    const n = await newNotification(u.id);
    const out = await dispatcher.dispatch({ userId: u.id, type: "certificate_issued", notificationId: n.id, now: IST_23H() });
    // certificate_issued defaults email off: switch it on and try again
    expect(out.find((d) => d.channel === "email")).toMatchObject({ status: "skipped", reasonCode: "preference_off" });
    await setPref(u.id, "certificate_issued", "email", true);
    const n2 = await newNotification(u.id);
    const [, email] = await dispatcher.dispatch({ userId: u.id, type: "certificate_issued", notificationId: n2.id, now: IST_23H() });
    expect(email).toMatchObject({ status: "queued", reasonCode: "quiet_hours" });
    expect(email!.deferredUntil!.getTime()).toBeGreaterThan(IST_23H().getTime() + 8 * 3600_000);

    const job = email!.job!;
    expect(await job.getState()).toBe("delayed");
    expect(job.opts.delay).toBeGreaterThan(8 * 3600_000);
    await new Promise((r) => setTimeout(r, 300));
    expect(sent).toHaveLength(0); // not sent during the window
    const row = await prisma.notificationDelivery.findUnique({ where: { id: email!.deliveryId } });
    expect(row).toMatchObject({ status: "queued", reasonCode: "quiet_hours" });
    expect(row!.scheduledFor).not.toBeNull();

    await job.promote(); // the window has ended
    await waitFor(() => sent.length === 1);
    await waitFor(async () => (await prisma.notificationDelivery.findUnique({ where: { id: email!.deliveryId } }))?.status === "sent");
  });

  it("quiet hours can be turned off by the member", async () => {
    const u = await newUser();
    await prisma.notificationSettings.create({ data: { userId: u.id, quietHoursEnabled: false } });
    await setPref(u.id, "certificate_issued", "email", true);
    const [, email] = await dispatcher.dispatch({ userId: u.id, type: "certificate_issued", now: IST_23H() });
    expect(email).toMatchObject({ status: "queued" });
    expect(email!.reasonCode).toBeUndefined();
    expect(await email!.job!.getState()).not.toBe("delayed");
  });

  it("at most 3 non-critical messages a day: the rest are skipped with frequency_cap, in-app still shows them", async () => {
    const u = await newUser();
    await setPref(u.id, "forum_reply", "email", true);
    const results: string[] = [];
    for (let i = 0; i < 5; i++) {
      const n = await newNotification(u.id);
      const out = await dispatcher.dispatch({ userId: u.id, type: "forum_reply", notificationId: n.id, now: IST_NOON() });
      results.push(out.map((d) => `${d.channel}:${d.status}${d.reasonCode ? `/${d.reasonCode}` : ""}`).join(","));
    }
    expect(results.slice(0, 3).every((r) => r === "in_app:delivered,email:queued")).toBe(true);
    expect(results.slice(3).every((r) => r === "in_app:delivered,email:skipped/frequency_cap")).toBe(true);
    // a critical message is not counted and not capped
    const crit = await dispatcher.dispatchEmail({ userId: u.id, type: "security_alert", to: u.email, template: { name: "suspicious-refresh-reuse" }, now: IST_NOON() });
    expect(crit.status).toBe("queued");
  });

  it("concurrent notifications cannot exceed the cap", async () => {
    const u = await newUser();
    await setPref(u.id, "forum_reply", "email", true);
    const results = await Promise.all(
      Array.from({ length: 6 }, () => dispatcher.dispatch({ userId: u.id, type: "forum_reply", now: IST_NOON() })),
    );
    const queued = results.flat().filter((d) => d.channel === "email" && d.status === "queued");
    expect(queued).toHaveLength(3);
  });

  it("WhatsApp is skipped without opt-in, and records no_provider with opt-in and a confirmed number", async () => {
    const u = await newUser();
    let out = await dispatcher.dispatch({ userId: u.id, type: "interview", now: IST_NOON() });
    expect(out.find((d) => d.channel === "whatsapp")).toMatchObject({ status: "skipped", reasonCode: "opt_out" });

    // opted in but the number is not confirmed yet: still opt_out
    await prisma.notificationSettings.create({ data: { userId: u.id, whatsappOptIn: true, whatsappNumber: "+919876543210" } });
    out = await dispatcher.dispatch({ userId: u.id, type: "interview", now: IST_NOON() });
    expect(out.find((d) => d.channel === "whatsapp")).toMatchObject({ status: "skipped", reasonCode: "opt_out" });

    await prisma.notificationSettings.update({ where: { userId: u.id }, data: { whatsappNumberConfirmedAt: new Date() } });
    await setPref(u.id, "interview", "whatsapp", true);
    out = await dispatcher.dispatch({ userId: u.id, type: "interview", now: IST_NOON() });
    expect(out.find((d) => d.channel === "whatsapp")).toMatchObject({ status: "skipped", reasonCode: "no_provider" });
    // the number is never copied into the log
    const rows = await deliveries(u.id);
    expect(JSON.stringify(rows)).not.toContain("9876543210");
    // events that do not allow WhatsApp record nothing for it
    out = await dispatcher.dispatch({ userId: u.id, type: "forum_reply", now: IST_NOON() });
    expect(out.some((d) => d.channel === "whatsapp")).toBe(false);
  });

  it("an unverified address gets no email (no_address)", async () => {
    const u = await newUser({ emailVerified: false });
    await setPref(u.id, "forum_reply", "email", true);
    const out = await dispatcher.dispatch({ userId: u.id, type: "forum_reply", now: IST_NOON() });
    expect(out.find((d) => d.channel === "email")).toMatchObject({ status: "skipped", reasonCode: "no_address" });
  });

  it("every decision through notify() has a delivery row, and approval is not emailed twice", async () => {
    const u = await newUser();
    await setPref(u.id, "forum_reply", "email", true);
    await notifications.notify(u.id, "forum_reply", { threadId: "t1" }, "k1");
    await notifications.notify(u.id, "approval", { approved: true }, "k2");
    await waitFor(async () => (await prisma.notification.count({ where: { userId: u.id } })) === 2);
    await waitFor(async () => (await deliveries(u.id)).length >= 3);
    await new Promise((r) => setTimeout(r, 300));
    const rows = await deliveries(u.id);
    const forum = rows.filter((r) => r.eventType === "forum_reply");
    expect(forum.map((r) => r.channel).sort()).toEqual(["email", "in_app"]);
    expect(forum.every((r) => r.notificationId)).toBe(true);
    // approval from notify(): in-app only (its email comes from sendApprovalNotice, once)
    expect(rows.filter((r) => r.eventType === "approval").map((r) => r.channel)).toEqual(["in_app"]);
  });

  it("the delivery log holds no address or number in its error summary", async () => {
    const u = await newUser();
    await dispatcher.markFailed(
      (await dispatcher.dispatch({ userId: u.id, type: "forum_reply", now: IST_NOON() }))[0]!.deliveryId,
      5,
      new Error("550 mailbox person@example.com unavailable, call +91 98765 43210"),
    );
    const row = (await deliveries(u.id))[0]!;
    expect(row.status).toBe("failed");
    expect(row.errorSummary).toContain("[email]");
    expect(row.errorSummary).not.toContain("person@example.com");
    expect(row.errorSummary).not.toContain("98765");
  });

  describe("subjects and previews", () => {
    const FORBIDDEN = /resume|résumé|cv\b|salary|compensation|ctc|private note|notes?:/i;
    const samples: EmailTemplate[] = [
      { name: "verification", link: "http://x/verify" },
      { name: "approved-verify", link: "http://x/verify" },
      { name: "welcome", firstName: "Asha", loginLink: "http://x/login" },
      { name: "password-reset-otp", otp: "123456" },
      { name: "approval", approved: true },
      { name: "approval", approved: false },
      { name: "role-change", roleNames: ["member"] },
      { name: "password-changed" },
      { name: "new-content", kind: "blog", title: "VLAN basics", link: "http://x/b" },
      { name: "suspicious-refresh-reuse" },
      ...NOTIFICATION_EVENTS.map((e) => ({ name: "event-notice" as const, eventType: e.type, link: "http://x/n", settingsLink: "http://x/s" })),
    ];
    it.each(samples.map((t, i) => [`${t.name}#${i}`, t] as const))("%s has no resume, compensation or notes", (_n, t) => {
      const { subject, text } = renderEmail(t);
      expect(subject).not.toMatch(FORBIDDEN);
      expect(text).not.toMatch(FORBIDDEN);
    });
    it("event notices never carry notification payload content", async () => {
      const u = await newUser();
      // notify() uses the real clock: turn quiet hours off so the email is not deferred
      await prisma.notificationSettings.create({ data: { userId: u.id, quietHoursEnabled: false } });
      await setPref(u.id, "forum_reply", "email", true);
      await notifications.notify(u.id, "forum_reply", { threadTitle: "SECRET-TITLE", note: "PRIVATE-NOTE", salary: "SECRET-CTC" }, "k-priv");
      await waitFor(() => sent.some((m) => m.to === u.email));
      expect(JSON.stringify(sent.filter((m) => m.to === u.email))).not.toMatch(/SECRET|PRIVATE/);
    });
  });

  it("transactional account emails are unaffected: no delay, no delivery row, sent as before", async () => {
    const u = await newUser();
    // The test clock cannot be injected into the senders, so assert the structure instead:
    // none of these routes through the dispatcher, whatever the time of day.
    const jobs = [
      await emails.sendVerificationEmail(u.email, `tok-${randomUUID()}`),
      await emails.sendPasswordResetOtp(u.email, "654321"),
      await emails.sendPasswordChangedNotice(u.email),
      await emails.sendWelcomeEmail(u.email, "Notify"),
    ];
    for (const j of jobs) expect(j.opts.delay ?? 0).toBe(0);
    await waitFor(() => sent.filter((m) => m.to === u.email).length === 4);
    expect(await deliveries(u.id)).toHaveLength(0);
    expect(jobs.every((j) => j.data.deliveryId === undefined)).toBe(true);
  });
});
