import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { TokenService } from "../src/modules/identity/application/services/token.service";
import { toPublicUser, userWithRolesInclude } from "../src/modules/identity";

// API-038 / API-039 (TASK-021): inbox, read-all, preferences, WhatsApp number stub.
jest.setTimeout(60_000);

describe("Notifications API (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const userIds: string[] = [];
  let me: { id: string; cookie: string };
  let other: { id: string; cookie: string };

  async function actor() {
    const tokens = app.get(TokenService);
    const user = await prisma.user.create({
      data: {
        firstName: "Api",
        lastName: "Notify",
        email: `na-${randomUUID()}@example.com`,
        isApproved: true,
        emailVerified: true,
        roles: { create: [{ role: { connect: { name: "member" } } }] },
      },
      include: userWithRolesInclude,
    });
    userIds.push(user.id);
    return { id: user.id, cookie: `accessToken=${tokens.signAccessToken(toPublicUser(user))}` };
  }
  const api = (method: "get" | "put" | "post", path: string, who = me) =>
    request(app.getHttpServer())[method](`/api${path}`).set("Cookie", who.cookie);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix("api");
    await app.init();
    prisma = app.get(PrismaService);
    me = await actor();
    other = await actor();
  });
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await app.close();
  });

  it("requires sign-in", async () => {
    await request(app.getHttpServer()).get("/api/notifications/preferences").expect(401);
    await request(app.getHttpServer()).put("/api/notifications/read-all").expect(401);
  });

  describe("inbox", () => {
    beforeAll(async () => {
      await prisma.notification.createMany({
        data: Array.from({ length: 5 }, (_, i) => ({
          userId: me.id,
          type: "forum_reply" as const,
          payload: { i },
          createdAt: new Date(Date.now() - i * 1000),
        })),
      });
      await prisma.notification.create({ data: { userId: other.id, type: "approval", payload: {} } });
    });

    it("is paginated, newest first, with the unread count and only my rows", async () => {
      const res = await api("get", "/notifications?page=1&pageSize=2").expect(200);
      expect(res.body).toMatchObject({ page: 1, pageSize: 2, total: 5, unreadCount: 5 });
      expect(res.body.items).toHaveLength(2);
      expect(res.body.items[0].payload.i).toBe(0);
      const p3 = await api("get", "/notifications?page=3&pageSize=2").expect(200);
      expect(p3.body.items).toHaveLength(1);
      await api("get", "/notifications?pageSize=500").expect(400);
    });

    it("mark all read changes only my rows", async () => {
      const res = await api("put", "/notifications/read-all").expect(200);
      expect(res.body).toEqual({ updated: 5 });
      expect((await api("get", "/notifications")).body.unreadCount).toBe(0);
      expect((await api("get", "/notifications/unread-count")).body.count).toBe(0);
      expect((await api("get", "/notifications", other)).body.unreadCount).toBe(1);
    });
  });

  describe("preferences", () => {
    it("returns defaults from the catalogue: in-app locked on, critical locked, WhatsApp off", async () => {
      const { body } = await api("get", "/notifications/preferences").expect(200);
      expect(body).toMatchObject({
        quietHoursEnabled: true,
        quietHoursStart: "21:00",
        quietHoursEnd: "08:00",
        timezone: "Asia/Kolkata",
        digestFrequency: "off",
        marketingOptIn: false,
        dailyCap: 3,
      });
      expect(body.whatsapp).toMatchObject({ optIn: false, numberMasked: null, providerConfigured: false });
      const sec = body.events.find((e: { type: string }) => e.type === "security_alert");
      expect(sec.channels.email).toMatchObject({ enabled: true, locked: true });
      expect(sec.channels.in_app).toMatchObject({ enabled: true, locked: true });
      const reply = body.events.find((e: { type: string }) => e.type === "forum_reply");
      expect(reply.channels.email.enabled).toBe(false);
      expect(reply.channels.whatsapp.allowed).toBe(false);
    });

    it("cannot switch off a critical event, nor use a channel the event does not allow", async () => {
      await api("put", "/notifications/preferences").send({ events: { security_alert: { email: false } } }).expect(400);
      await api("put", "/notifications/preferences").send({ events: { forum_reply: { whatsapp: true } } }).expect(400);
      await api("put", "/notifications/preferences").send({ events: { forum_reply: { in_app: false } } }).expect(400);
      await api("put", "/notifications/preferences").send({ events: { nonsense: { email: true } } }).expect(400);
      await api("put", "/notifications/preferences").send({ quietHoursStart: "25:00" }).expect(400);
      expect(await prisma.notificationPreference.count({ where: { userId: me.id } })).toBe(0);
    });

    it("saves changes, returns them, and records each change with a time", async () => {
      const res = await api("put", "/notifications/preferences")
        .send({
          events: { forum_reply: { email: true }, approval: { email: false } },
          quietHoursStart: "22:00",
          quietHoursEnd: "07:00",
          digestFrequency: "weekly",
          marketingOptIn: true,
        })
        .expect(200);
      expect(res.body.quietHoursStart).toBe("22:00");
      expect(res.body.digestFrequency).toBe("weekly");
      expect(res.body.marketingOptIn).toBe(true);
      const get = (t: string) => res.body.events.find((e: { type: string }) => e.type === t).channels.email.enabled;
      expect(get("forum_reply")).toBe(true);
      expect(get("approval")).toBe(false);

      const log = await prisma.notificationPreferenceChange.findMany({ where: { userId: me.id } });
      expect(log).toHaveLength(1);
      expect(log[0]!.createdAt).toBeInstanceOf(Date);
      const fields = (log[0]!.changes as { field: string }[]).map((c) => c.field).sort();
      expect(fields).toEqual(["approval.email", "digestFrequency", "forum_reply.email", "marketingOptIn", "quietHoursEnd", "quietHoursStart"]);
      expect((await prisma.notificationSettings.findUniqueOrThrow({ where: { userId: me.id } })).marketingOptInAt).not.toBeNull();

      // saving the same values again changes nothing and logs nothing
      await api("put", "/notifications/preferences").send({ digestFrequency: "weekly" }).expect(200);
      expect(await prisma.notificationPreferenceChange.count({ where: { userId: me.id } })).toBe(1);
    });

    it("preferences are the caller's own: another member is unaffected", async () => {
      const { body } = await api("get", "/notifications/preferences", other).expect(200);
      expect(body.digestFrequency).toBe("off");
      expect(body.marketingOptIn).toBe(false);
    });
  });

  describe("WhatsApp opt-in", () => {
    it("refuses opt-in before a number is on file, then records the confirmation request and sends nothing", async () => {
      await api("put", "/notifications/preferences").send({ whatsappOptIn: true }).expect(400);
      await api("post", "/notifications/whatsapp/confirm-number").send({ number: "12345" }).expect(400);
      const res = await api("post", "/notifications/whatsapp/confirm-number").send({ number: "+919876543210" }).expect(200);
      expect(res.body).toMatchObject({ status: "pending", numberMasked: "•••••••••3210", providerConfigured: false });
      expect(JSON.stringify(res.body)).not.toContain("9876543");
      const row = await prisma.notificationSettings.findUniqueOrThrow({ where: { userId: me.id } });
      expect(row.whatsappNumberRequestedAt).not.toBeNull();
      expect(row.whatsappNumberConfirmedAt).toBeNull();
      const change = await prisma.notificationPreferenceChange.findMany({ where: { userId: me.id } });
      expect(JSON.stringify(change)).not.toContain("9876543");

      const opt = await api("put", "/notifications/preferences").send({ whatsappOptIn: true }).expect(200);
      expect(opt.body.whatsapp).toMatchObject({ optIn: true, confirmedAt: null, numberMasked: "•••••••••3210" });
      // opted in but unconfirmed: the dispatcher still records opt_out (covered in the dispatch spec)
      expect(await prisma.notificationDelivery.count({ where: { userId: me.id, channel: "whatsapp" } })).toBe(0);
    });

    it("changing the number clears an earlier confirmation", async () => {
      await prisma.notificationSettings.update({ where: { userId: me.id }, data: { whatsappNumberConfirmedAt: new Date() } });
      await api("post", "/notifications/whatsapp/confirm-number").send({ number: "+919811112222" }).expect(200);
      expect((await prisma.notificationSettings.findUniqueOrThrow({ where: { userId: me.id } })).whatsappNumberConfirmedAt).toBeNull();
    });
  });
});
