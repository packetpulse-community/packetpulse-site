import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { BullModule, getQueueToken } from "@nestjs/bullmq";
import { Test, TestingModule } from "@nestjs/testing";
import { Queue, Worker } from "bullmq";
import { randomUUID } from "node:crypto";
import { EmailQueueService } from "../src/modules/notifications/application/services/email-queue.service";
import { NotificationsService } from "../src/modules/notifications/application/services/notifications.service";
import { MailDeliveryError, MailerService } from "../src/modules/notifications/infrastructure/email/mailer.service";
import { EmailProcessor } from "../src/modules/notifications/infrastructure/queue/email.processor";
import { FanoutProcessor } from "../src/modules/notifications/infrastructure/queue/fanout.processor";
import { PrismaService } from "../src/prisma/prisma.service";
import { RealtimeEmitterService } from "../src/common/realtime/realtime-emitter.service";

// TEST-009 (job part, TASK-016): background jobs retry without duplicating.
// Runs the real queue services and processors on an isolated BullMQ prefix with a mailer
// test double, so parallel suites on the same Redis never see these jobs (and vice versa).
describe("Background jobs (e2e)", () => {
  const prefix = `test-queues-${randomUUID().slice(0, 8)}`;
  const redisUrl = process.env.REDIS_URL!;
  let moduleRef: TestingModule;
  let emailQueue: Queue;
  let fanoutQueue: Queue;
  let emails: EmailQueueService;
  let notifications: NotificationsService;
  let processor: EmailProcessor;
  let errorLog: jest.SpyInstance;

  // Mailer double: counts sends and fails the next N calls (permanently or not).
  const mailer = {
    sends: 0,
    failNext: 0,
    failPermanent: false,
    async send() {
      if (this.failNext > 0) {
        this.failNext--;
        throw new MailDeliveryError("provider down", this.failPermanent);
      }
      this.sends++;
    },
    reset() {
      this.sends = 0;
      this.failNext = 0;
      this.failPermanent = false;
    },
  };
  const prismaStub = { notification: { create: jest.fn(async ({ data }) => ({ id: randomUUID(), ...data })) } };
  const realtimeStub = { emit: jest.fn(async () => undefined) };

  async function waitFor(check: () => Promise<boolean> | boolean, ms = 15_000) {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (await check()) return;
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error("waitFor timed out");
  }
  const alertLines = () =>
    errorLog.mock.calls
      .map((c) => String(c[0]))
      .filter((l) => l.startsWith("{") && l.includes('"alert":true'))
      .map((l) => JSON.parse(l) as Record<string, unknown>);

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        BullModule.forRoot({ connection: { url: redisUrl }, prefix }),
        BullModule.registerQueue({ name: "email" }, { name: "fanout" }),
      ],
      providers: [
        EmailQueueService,
        NotificationsService,
        EmailProcessor,
        FanoutProcessor,
        { provide: MailerService, useValue: mailer },
        { provide: PrismaService, useValue: prismaStub },
        { provide: RealtimeEmitterService, useValue: realtimeStub },
        { provide: ConfigService, useValue: { get: (k: string) => ({ QUEUE_BACKOFF_MS: "50", FRONTEND_URL: "http://localhost:3000" })[k] } },
      ],
    }).compile();
    await moduleRef.init();
    emailQueue = moduleRef.get(getQueueToken("email"));
    fanoutQueue = moduleRef.get(getQueueToken("fanout"));
    emails = moduleRef.get(EmailQueueService);
    notifications = moduleRef.get(NotificationsService);
    processor = moduleRef.get(EmailProcessor);
  });

  beforeEach(() => {
    mailer.reset();
    errorLog = jest.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  afterAll(async () => {
    // Only this run's prefix is touched.
    await emailQueue.obliterate({ force: true });
    await fanoutQueue.obliterate({ force: true });
    await moduleRef.close();
  });

  it("a job that fails twice then succeeds is sent exactly once and completes", async () => {
    mailer.failNext = 2;
    const job = await emails.sendPasswordResetOtp("retry@example.com", "123456");
    await waitFor(async () => (await job.getState()) === "completed");
    expect(mailer.sends).toBe(1);
    expect((await emailQueue.getJob(job.id!))!.attemptsMade).toBe(3);
    expect(alertLines()).toHaveLength(0);
  });

  it("the same idempotency key enqueued twice sends once", async () => {
    const a = await emails.sendVerificationEmail("dupe@example.com", "tok-1");
    const b = await emails.sendVerificationEmail("dupe@example.com", "tok-1");
    expect(b.id).toBe(a.id);
    await waitFor(async () => (await a.getState()) === "completed");
    await new Promise((r) => setTimeout(r, 300));
    expect(mailer.sends).toBe(1);
    // a different token is a different logical job
    const c = await emails.sendVerificationEmail("dupe@example.com", "tok-2");
    expect(c.id).not.toBe(a.id);
    await waitFor(async () => (await c.getState()) === "completed");
    expect(mailer.sends).toBe(2);
    // the job id never contains the token or address
    expect(a.id).not.toContain("tok-1");
    expect(a.id).not.toContain("dupe");
  });

  it("a job that always fails ends failed after the configured attempts, with an alert line", async () => {
    mailer.failNext = 99;
    const job = await emails.sendPasswordResetOtp("always@example.com", "999999");
    await waitFor(async () => (await job.getState()) === "failed");
    const stored = (await emailQueue.getJob(job.id!))!;
    expect(stored.attemptsMade).toBe(5);
    expect(mailer.sends).toBe(0);
    await waitFor(() => alertLines().length > 0);
    const alerts = alertLines();
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      alert: true,
      event: "job_failed",
      queue: "email",
      jobId: job.id,
      attempts: 5,
      permanent: false,
      domain: "example.com",
    });
    const line = JSON.stringify(alerts[0]);
    expect(line).not.toContain("always@");
    expect(line).not.toContain("999999");
  });

  it("a permanent failure does not retry", async () => {
    mailer.failNext = 99;
    mailer.failPermanent = true;
    const job = await emails.sendPasswordChangedNotice("perm@example.com");
    await waitFor(async () => (await job.getState()) === "failed");
    expect((await emailQueue.getJob(job.id!))!.attemptsMade).toBe(1);
    await waitFor(() => alertLines().length > 0);
    expect(alertLines()[0]).toMatchObject({ event: "job_failed", permanent: true, attempts: 1 });
  });

  it("an invalid recipient fails at once without calling the mailer", async () => {
    mailer.failNext = 0;
    const job = await emails.sendPasswordChangedNotice("not-an-address");
    await waitFor(async () => (await job.getState()) === "failed");
    expect((await emailQueue.getJob(job.id!))!.attemptsMade).toBe(1);
    expect(mailer.sends).toBe(0);
  });

  it("fan-out: same idempotency key creates one notification; no key creates each", async () => {
    prismaStub.notification.create.mockClear();
    const a = await notifications.notify("u1", "forum_reply" as never, { threadId: "t" }, "reply-1");
    const b = await notifications.notify("u1", "forum_reply" as never, { threadId: "t" }, "reply-1");
    expect(b.id).toBe(a.id);
    await waitFor(async () => (await a.getState()) === "completed");
    expect(prismaStub.notification.create).toHaveBeenCalledTimes(1);
    const c = await notifications.notify("u1", "forum_reply" as never, { threadId: "t" });
    const d = await notifications.notify("u1", "forum_reply" as never, { threadId: "t" });
    expect(c.id).not.toBe(d.id);
    await waitFor(async () => (await d.getState()) === "completed" && (await c.getState()) === "completed");
    expect(prismaStub.notification.create).toHaveBeenCalledTimes(3);
  });

  it("fan-out: a realtime push failure after the row is saved does not retry or duplicate", async () => {
    prismaStub.notification.create.mockClear();
    realtimeStub.emit.mockRejectedValueOnce(new Error("socket down"));
    const job = await notifications.notify("u2", "forum_reply" as never, {}, "reply-rt");
    await waitFor(async () => (await job.getState()) === "completed");
    expect(prismaStub.notification.create).toHaveBeenCalledTimes(1);
  });

  it("a stalled job is detected and raises an alert", async () => {
    const stallPrefixQueue = new Queue("email-stall-probe", { connection: { url: redisUrl }, prefix });
    // Never finishes and never renews its lock, so the lock lapses like a crashed worker's.
    const worker = new Worker("email-stall-probe", () => new Promise(() => undefined), {
      connection: { url: redisUrl },
      prefix,
      lockDuration: 300,
      stalledInterval: 300,
      skipLockRenewal: true,
    });
    const stalled: string[] = [];
    worker.on("stalled", (jobId) => {
      stalled.push(jobId);
      processor.onStalled(jobId); // the real handler the production worker uses
    });
    try {
      const job = await stallPrefixQueue.add("send", { to: "x@example.com" }, { jobId: "probe-1" });
      await waitFor(() => stalled.includes(job.id!), 20_000);
      const alert = alertLines().find((a) => a.event === "job_stalled");
      expect(alert).toMatchObject({ alert: true, queue: "email", jobId: "probe-1" });
    } finally {
      await worker.close(true);
      await stallPrefixQueue.obliterate({ force: true });
      await stallPrefixQueue.close();
    }
  });
});
