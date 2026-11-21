import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { TokenService } from "../src/modules/identity/application/services/token.service";
import { toPublicUser, userWithRolesInclude } from "../src/modules/identity";
import { FeatureFlagsService, FLAG_CACHE_KEY, FLAG_HASH } from "../src/modules/feature-flags/feature-flags.service";
import { NotificationDispatcher } from "../src/modules/notifications/application/services/notification-dispatcher.service";
import { FEATURE_FLAG_KEYS } from "@packetpulse/types";
import { FEATURE_FLAGS } from "../src/modules/feature-flags";
import { REDIS_CLIENT } from "../src/common/redis/redis.constants";
import type Redis from "ioredis";

// TASK-047 / T-12: feature switches. Real database and Redis; each test restores the defaults.
type Actor = { get: (p: string) => request.Test; post: (p: string) => request.Test; put: (p: string) => request.Test };

describe("Feature switches (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let flags: FeatureFlagsService;
  let redis: Redis;
  const adminEmail = "e2e-flags-admin@example.com";
  const memberEmail = "e2e-flags-member@example.com";
  const password = "Passw0rd!23";
  const REASON = "Pausing for the planned data migration";
  let admin: Actor;
  let member: Actor;

  const put = (key: string, body: object) => admin.put(`/api/admin/feature-flags/${key}`).send(body);
  async function reset() {
    await redis.del(FLAG_HASH, FLAG_CACHE_KEY);
    await prisma.featureFlag.deleteMany();
    await prisma.siteSettings.upsert({ where: { id: "default" }, update: { registrationEnabled: true }, create: { id: "default" } });
    flags.invalidate();
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix("api");
    await app.init();
    prisma = app.get(PrismaService);
    flags = app.get(FeatureFlagsService);
    redis = app.get(REDIS_CLIENT);
    await prisma.user.deleteMany({ where: { email: { in: [adminEmail, memberEmail] } } });
    const tokens = app.get(TokenService);
    const make = async (email: string, role: string) => {
      const user = await prisma.user.create({
        data: {
          firstName: "Flag",
          lastName: role,
          email,
          isApproved: true,
          emailVerified: true,
          roles: { create: [{ role: { connect: { name: role } } }] },
        },
        include: userWithRolesInclude,
      });
      return `accessToken=${tokens.signAccessToken(toPublicUser(user))}`;
    };
    const adminCookie = await make(adminEmail, "admin");
    const memberCookie = await make(memberEmail, "member");
    // Signed access tokens, no /login: nothing here depends on the sign-up or login flows.
    const as = (cookie: string) => ({
      get: (path: string) => request(app.getHttpServer()).get(path).set("Cookie", cookie),
      post: (path: string) => request(app.getHttpServer()).post(path).set("Cookie", cookie),
      put: (path: string) => request(app.getHttpServer()).put(path).set("Cookie", cookie),
    });
    admin = as(adminCookie);
    member = as(memberCookie);
    await reset();
  });

  afterEach(reset);

  afterAll(async () => {
    await reset();
    await prisma.user.deleteMany({ where: { email: { in: [adminEmail, memberEmail] } } });
    await app.close();
  });

  it("keeps the registry and the shared key list in step, with every default keeping today's behaviour", () => {
    expect(FEATURE_FLAGS.map((f) => f.key).sort()).toEqual([...FEATURE_FLAG_KEYS].sort());
    // Every switch defaults to today's behaviour: features on, and the DEC-035 instant-access switch off.
    expect(FEATURE_FLAGS.filter((f) => f.key !== "onboarding.instant_access").every((f) => f.defaultValue === true)).toBe(true);
  });

  describe("public read endpoint", () => {
    it("is open, cached briefly, and exposes only the public flags", async () => {
      const res = await request(app.getHttpServer()).get("/api/feature-flags").expect(200);
      expect(res.headers["cache-control"]).toContain("max-age=");
      expect(res.body.flags).toMatchObject({ "registration.open": true, "forums.posting": true, "quizzes.attempts": true });
      expect(res.body.flags).not.toHaveProperty("notifications.email");
    });

    it("reflects a change", async () => {
      await put("forums.posting", { enabled: false, reason: REASON }).expect(200);
      const res = await request(app.getHttpServer()).get("/api/feature-flags").expect(200);
      expect(res.body.flags["forums.posting"]).toBe(false);
    });
  });

  describe("admin endpoints", () => {
    it("lists every flag with its metadata for an admin", async () => {
      const res = await admin.get("/api/admin/feature-flags").expect(200);
      expect(res.body).toHaveLength(FEATURE_FLAG_KEYS.length);
      expect(res.body.find((f: { key: string }) => f.key === "notifications.email")).toMatchObject({
        enabled: true,
        public: false,
        defaultValue: true,
        overridden: false,
        changePermission: "admin:manage-settings",
      });
    });

    it("refuses members and visitors", async () => {
      await member.get("/api/admin/feature-flags").expect(403);
      await member.put("/api/admin/feature-flags/forums.posting").send({ enabled: false, reason: REASON }).expect(403);
      await request(app.getHttpServer()).put("/api/admin/feature-flags/forums.posting").send({ enabled: false, reason: REASON }).expect(401);
      expect(await flags.isEnabled("forums.posting")).toBe(true);
    });

    it("requires a reason of at least 10 characters and a boolean", async () => {
      await put("forums.posting", { enabled: false }).expect(400);
      const short = await put("forums.posting", { enabled: false, reason: "too short" }).expect(400);
      expect(short.body.code).toBe("VALIDATION_FAILED");
      await put("forums.posting", { enabled: "no", reason: REASON }).expect(400);
      expect(await flags.isEnabled("forums.posting")).toBe(true);
    });

    it("rejects an unknown flag", async () => {
      const res = await put("does.not.exist", { enabled: false, reason: REASON }).expect(404);
      expect(res.body.code).toBe("NOT_FOUND");
    });

    it("writes one audit entry per real change, with the reason, and none for a no-op", async () => {
      const count = () => prisma.adminActivityLog.count({ where: { targetType: "feature_flag", targetId: "blogs.comments" } });
      const before = await count();
      const res = await put("blogs.comments", { enabled: false, reason: REASON }).expect(200);
      expect(res.body).toMatchObject({ key: "blogs.comments", enabled: false, overridden: true, source: "override" });
      expect(await count()).toBe(before + 1);
      const entry = await prisma.adminActivityLog.findFirst({
        where: { targetType: "feature_flag", targetId: "blogs.comments" },
        orderBy: { createdAt: "desc" },
      });
      expect(entry).toMatchObject({ action: "site_settings_changed", reason: REASON });
      expect(entry?.details).toMatchObject({ feature: "blogs.comments", old: true, new: false });
      await put("blogs.comments", { enabled: false, reason: REASON }).expect(200);
      expect(await count()).toBe(before + 1);
    });
  });

  describe("enforcement", () => {
    it("registration.open (backed by the existing site setting) refuses sign-up with FEATURE_DISABLED", async () => {
      await put("registration.open", { enabled: false, reason: REASON }).expect(200);
      expect((await prisma.siteSettings.findUnique({ where: { id: "default" } }))?.registrationEnabled).toBe(false);
      const res = await request(app.getHttpServer())
        .post("/api/auth/register")
        .send({ firstName: "No", lastName: "Entry", email: "e2e-flags-new@example.com", password })
        .expect(403);
      expect(res.body).toMatchObject({ code: "FEATURE_DISABLED", feature: "registration.open" });
      expect(res.body.message).toMatch(/switched off/);
      await put("registration.open", { enabled: true, reason: REASON }).expect(200);
      const open = await request(app.getHttpServer()).post("/api/auth/register").send({}).expect(400);
      expect(open.body.code).toBe("VALIDATION_FAILED");
    });

    it("the existing Settings screen and the switch agree", async () => {
      await prisma.siteSettings.update({ where: { id: "default" }, data: { registrationEnabled: false } });
      flags.invalidate();
      expect(await flags.isEnabled("registration.open")).toBe(false);
    });

    const cases: [string, string, string, string][] = [
      ["forums.posting", "POST", "/api/forums/threads", "Forum posting"],
      ["forums.posting", "POST", "/api/forums/threads/00000000-0000-4000-8000-000000000000/replies", "Forum posting"],
      ["quizzes.attempts", "POST", "/api/quizzes/00000000-0000-4000-8000-000000000000/attempts", "quiz attempt"],
      ["resources.uploads", "POST", "/api/resources", "resources"],
      ["files.uploads", "POST", "/api/files/upload-url", "uploads"],
      ["blogs.comments", "POST", "/api/blogs/00000000-0000-4000-8000-000000000000/comments", "Commenting"],
    ];
    it.each(cases)("%s off: %s %s returns FEATURE_DISABLED, and is not blocked when on", async (key, method, path, label) => {
      const call = () => member.post(path).send({});
      const onRes = await call();
      expect(onRes.body.code).not.toBe("FEATURE_DISABLED");
      await put(key, { enabled: false, reason: REASON }).expect(200);
      const res = await call();
      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ code: "FEATURE_DISABLED", feature: key });
      expect(res.body.message.toLowerCase()).toContain(label.toLowerCase());
    });

    it("a switch does not turn a signed-out caller into a 403 about the feature", async () => {
      await put("forums.posting", { enabled: false, reason: REASON }).expect(200);
      await request(app.getHttpServer()).post("/api/forums/threads").send({}).expect(401);
    });

    it("notifications.email off skips non-critical email (feature_off) but not critical mail", async () => {
      const u = await prisma.user.create({
        data: { firstName: "N", lastName: "E", email: `ff-${Date.now()}@example.com`, emailVerified: true, isApproved: true },
      });
      try {
        const dispatcher = app.get(NotificationDispatcher);
        await put("notifications.email", { enabled: false, reason: REASON }).expect(200);
        const n1 = await prisma.notification.create({ data: { userId: u.id, type: "forum_reply", payload: {} } });
        const d1 = await dispatcher.dispatch({ userId: u.id, type: "forum_reply", notificationId: n1.id });
        expect(d1.find((d) => d.channel === "email")).toMatchObject({ status: "skipped", reasonCode: "feature_off" });
        const n2 = await prisma.notification.create({ data: { userId: u.id, type: "security_alert", payload: {} } });
        const d2 = await dispatcher.dispatch({ userId: u.id, type: "security_alert", notificationId: n2.id });
        expect(d2.find((d) => d.channel === "email")?.reasonCode).not.toBe("feature_off");
      } finally {
        await prisma.user.delete({ where: { id: u.id } });
      }
    });

    it("keeps flags in the database: a Redis flush changes nothing", async () => {
      await put("forums.posting", { enabled: false, reason: REASON }).expect(200);
      expect(await prisma.featureFlag.findUnique({ where: { key: "forums.posting" } })).toMatchObject({ enabled: false });
      await redis.flushdb();
      flags.invalidate();
      expect(await flags.isEnabled("forums.posting")).toBe(false);
      const row = (await admin.get("/api/admin/feature-flags").expect(200)).body.find((f: { key: string }) => f.key === "forums.posting");
      expect(row).toMatchObject({ enabled: false, overridden: true, source: "override" });
    });

    it("still answers from the database when Redis is unreachable", async () => {
      await put("forums.posting", { enabled: false, reason: REASON }).expect(200);
      const get = jest.spyOn(redis, "get").mockRejectedValue(new Error("down"));
      const set = jest.spyOn(redis, "set").mockRejectedValue(new Error("down"));
      flags.invalidate();
      expect(await flags.isEnabled("forums.posting")).toBe(false);
      get.mockRestore();
      set.mockRestore();
    });

    it("imports the old interim Redis hash into the table once, without overwriting newer rows", async () => {
      const entry = (enabled: boolean) => JSON.stringify({ enabled, at: new Date().toISOString(), by: "legacy-admin" });
      await redis.hset(FLAG_HASH, "quizzes.attempts", entry(false), "resources.uploads", entry(false), "junk.key", entry(false));
      await prisma.featureFlag.create({ data: { key: "resources.uploads", enabled: true, updatedBy: "newer" } });
      expect(await flags.importLegacyRedisFlags()).toBe(2);
      expect(await redis.exists(FLAG_HASH)).toBe(0);
      expect(await prisma.featureFlag.findUnique({ where: { key: "quizzes.attempts" } })).toMatchObject({ enabled: false, updatedBy: "legacy-admin" });
      expect(await prisma.featureFlag.findUnique({ where: { key: "resources.uploads" } })).toMatchObject({ enabled: true, updatedBy: "newer" });
      expect(await prisma.featureFlag.findUnique({ where: { key: "junk.key" } })).toBeNull();
      flags.invalidate();
      expect(await flags.isEnabled("quizzes.attempts")).toBe(false);
    });

    it("defaults onboarding.instant_access to off (DEC-035: approval kept)", async () => {
      expect(await flags.isEnabled("onboarding.instant_access")).toBe(false);
    });
  });
});
