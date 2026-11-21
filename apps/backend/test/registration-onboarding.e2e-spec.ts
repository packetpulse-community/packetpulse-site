import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import { createHash } from "node:crypto";
import request from "supertest";
import type Redis from "ioredis";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { REDIS_CLIENT } from "../src/common/redis/redis.constants";
import { EmailQueueService } from "../src/modules/notifications";
import { EmailCodeService } from "../src/modules/identity/application/services/email-code.service";
import { EmailVerificationService } from "../src/modules/identity/application/services/email-verification.service";
import { FeatureFlagsService } from "../src/modules/feature-flags/feature-flags.service";
import { acceptedConsents } from "./helpers/consents";

// TASK-022 / TASK-023: PRD-001 (email code), PRD-003 (required details), PRD-004 (18+),
// PRD-006 (WhatsApp), TEST-001, TEST-002, TEST-003. Real database and Redis. Emails are captured by
// replacing the queue senders, so a code is only ever read the way a member would read it.
//
// The auth-strict throttle allows 5 calls per route per app instance, so each describe builds its
// own app and stays inside that budget; lockout and concurrency are exercised on the service.

const PASSWORD = "Passw0rd!23";
const PREFIX = "e2e-regon-";
const emailOf = (n: string) => `${PREFIX}${n}@example.com`;
const hashEmail = (email: string) => createHash("sha256").update(email.trim().toLowerCase()).digest("hex");

interface Ctx {
  app: INestApplication;
  prisma: PrismaService;
  redis: Redis;
  flags: FeatureFlagsService;
  codes: string[];
  links: string[];
  server: () => ReturnType<INestApplication["getHttpServer"]>;
}

async function boot(): Promise<Ctx> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  app.use(cookieParser());
  app.setGlobalPrefix("api");
  await app.init();
  const queue = app.get(EmailQueueService);
  const ctx = {
    app,
    prisma: app.get(PrismaService),
    redis: app.get<Redis>(REDIS_CLIENT),
    flags: app.get(FeatureFlagsService),
    codes: [] as string[],
    links: [] as string[],
    server: () => app.getHttpServer(),
  };
  jest.spyOn(queue, "sendEmailCode").mockImplementation(async (_to, code) => void ctx.codes.push(code) as never);
  jest.spyOn(queue, "sendApprovedVerificationEmail").mockImplementation(async (_to, token, code) => {
    ctx.links.push(token);
    if (code) ctx.codes.push(code);
    return undefined as never;
  });
  jest.spyOn(queue, "sendVerificationEmail").mockImplementation(async (_to, token, code) => {
    ctx.links.push(token);
    if (code) ctx.codes.push(code);
    return undefined as never;
  });
  jest.spyOn(queue, "sendWelcomeEmail").mockResolvedValue(undefined as never);
  return ctx;
}

async function clean(ctx: Ctx) {
  const emails = (await ctx.prisma.user.findMany({ where: { email: { startsWith: PREFIX } }, select: { email: true } })).map((u) => u.email);
  await ctx.prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  const keys: string[] = [];
  for (const e of [...emails, ...Array.from({ length: 20 }, (_, i) => emailOf(String(i))), emailOf("unknown")]) {
    const h = hashEmail(e);
    keys.push(`emailcode:fail:${h}`, `emailcode:sends:${h}`, `emailcode:cooldown:${h}`);
  }
  await ctx.redis.del(...keys);
  await ctx.prisma.featureFlag.deleteMany({ where: { key: "onboarding.instant_access" } });
  ctx.flags.invalidate();
}

// Sends a registration and asserts the status (201 unless told otherwise), returning the response.
const register = async (ctx: Ctx, name: string, extra: Record<string, unknown> = {}, status = 201) =>
  request(ctx.server())
    .post("/api/auth/register")
    .send({
      firstName: "Reg",
      lastName: name,
      email: emailOf(name),
      password: PASSWORD,
      ageConfirmed: true,
      consents: await acceptedConsents(ctx.prisma),
      ...extra,
    })
    .expect(status);

jest.setTimeout(120_000);

describe("Registration: age confirmation and WhatsApp (TEST-001)", () => {
  let ctx: Ctx;
  beforeAll(async () => {
    ctx = await boot();
    await clean(ctx);
  });
  afterAll(async () => {
    await clean(ctx);
    await ctx.app.close();
  });

  it("refuses a sign-up without the 18+ confirmation, with an inline field error", async () => {
    const res = await register(ctx, "0", { ageConfirmed: undefined }, 400);
    expect(res.body.code).toBe("VALIDATION_FAILED");
    expect(res.body.fields.map((f: { path: string }) => f.path)).toContain("ageConfirmed");
    expect(await ctx.prisma.user.count({ where: { email: emailOf("0") } })).toBe(0);
  });

  it("rejects a malformed WhatsApp number and names the field", async () => {
    const res = await register(ctx, "1", { whatsappNumber: "12345" }, 400);
    expect(res.body.fields.map((f: { path: string }) => f.path)).toContain("whatsappNumber");
  });

  it("stores the confirmation as a timestamp and the number as E.164, defaulting to India", async () => {
    const res = await register(ctx, "2", { whatsappNumber: "98765 43210" });
    expect(res.body).toMatchObject({ isApproved: false, emailVerified: false, onboardingComplete: false, emailCodeSent: false });
    expect(res.body).not.toHaveProperty("dateOfBirth");
    const user = await ctx.prisma.user.findUniqueOrThrow({ where: { email: emailOf("2") } });
    expect(user.whatsappNumber).toBe("+919876543210");
    expect(user.ageConfirmedAt).not.toBeNull();
    expect(user.dateOfBirth).toBeNull(); // collected in onboarding, never at sign-up
  });

  it("treats a blank WhatsApp number as not given", async () => {
    await register(ctx, "3", { whatsappNumber: "  " });
    expect((await ctx.prisma.user.findUniqueOrThrow({ where: { email: emailOf("3") } })).whatsappNumber).toBeNull();
  });

  it("keeps today's approval gate: no email at sign-up, and a pending member cannot sign in (DEC-035 off)", async () => {
    expect(ctx.codes).toHaveLength(0);
    const res = await request(ctx.server()).post("/api/auth/login").send({ email: emailOf("2"), password: PASSWORD }).expect(403);
    expect(res.body.message).toMatch(/pending admin approval/);
  });
});

describe("Email code: approval path and security (TEST-002)", () => {
  let ctx: Ctx;
  beforeAll(async () => {
    ctx = await boot();
    await clean(ctx);
  });
  afterAll(async () => {
    await clean(ctx);
    await ctx.app.close();
  });

  const latest = () => ctx.codes[ctx.codes.length - 1]!;
  const wrongFor = (code: string) => (code === "000000" ? "111111" : "000000");
  const verify = (email: string, code: string) => request(ctx.server()).post("/api/auth/verify-email-code").send({ email, code });

  let userId: string;
  it("an admin approval sends one email carrying the 6-digit code and the old link; only a hash is stored", async () => {
    await register(ctx, "4");
    const user = await ctx.prisma.user.findUniqueOrThrow({ where: { email: emailOf("4") } });
    userId = user.id;
    await ctx.prisma.user.update({ where: { id: userId }, data: { isApproved: true } });
    await ctx.app.get(EmailVerificationService).send(userId, user.email, "approval"); // what AdminUsersService.setApproval calls
    expect(latest()).toMatch(/^\d{6}$/);
    expect(ctx.links).toHaveLength(1);
    const row = await ctx.prisma.emailVerificationCode.findFirstOrThrow({ where: { userId } });
    expect(row.codeHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.codeHash).not.toContain(latest());
    expect(row.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(10 * 60_000);
    expect(row.expiresAt.getTime() - Date.now()).toBeGreaterThan(9 * 60_000);
  });

  it("a wrong code and an unknown address give the same answer (enumeration-safe)", async () => {
    const wrong = await verify(emailOf("4"), wrongFor(latest())).expect(400);
    const unknown = await verify(emailOf("unknown"), "123456").expect(400);
    expect(unknown.body.message).toBe(wrong.body.message);
    expect(unknown.body.code).toBe(wrong.body.code);
  });

  it("an expired code is refused", async () => {
    await ctx.prisma.emailVerificationCode.updateMany({ where: { userId }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await verify(emailOf("4"), latest()).expect(400);
    await ctx.prisma.emailVerificationCode.updateMany({ where: { userId }, data: { expiresAt: new Date(Date.now() + 5 * 60_000) } });
  });

  it("the right code verifies the address once; a replay is refused; approval is not changed", async () => {
    await verify(emailOf("4"), latest()).expect(200);
    const user = await ctx.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.emailVerified).toBe(true);
    await verify(emailOf("4"), latest()).expect(400);
  });

  it("the 24 h link still verifies an address (existing flow)", async () => {
    await register(ctx, "5");
    const u = await ctx.prisma.user.update({ where: { email: emailOf("5") }, data: { isApproved: true } });
    await ctx.app.get(EmailVerificationService).send(u.id, u.email, "approval");
    const token = ctx.links[ctx.links.length - 1]!;
    await request(ctx.server()).post("/api/auth/verify-email").send({ token }).expect(200);
    expect((await ctx.prisma.user.findUniqueOrThrow({ where: { id: u.id } })).emailVerified).toBe(true);
    await request(ctx.server()).post("/api/auth/verify-email").send({ token }).expect(400); // single use
  });
});

describe("Email code: lockout, single use and resend limits (service level)", () => {
  let ctx: Ctx;
  let codes: EmailCodeService;
  beforeAll(async () => {
    ctx = await boot();
    await clean(ctx);
    codes = ctx.app.get(EmailCodeService);
  });
  afterAll(async () => {
    await clean(ctx);
    await ctx.app.close();
  });

  async function member(name: string) {
    await register(ctx, name);
    return ctx.prisma.user.findUniqueOrThrow({ where: { email: emailOf(name) } });
  }

  it("locks the address after 5 wrong codes, even for the right code, and the lock outlives a new code", async () => {
    const u = await member("6");
    const code = await codes.create(u.id);
    const wrong = code === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++) await expect(codes.consume(u.email, wrong)).rejects.toMatchObject({ status: 400 });
    await expect(codes.consume(u.email, code)).rejects.toMatchObject({ status: 429 });
    const fresh = await codes.create(u.id); // asking for a new code does not clear the lock
    await expect(codes.consume(u.email, fresh)).rejects.toMatchObject({ status: 429 });
    expect(await ctx.redis.ttl(`emailcode:fail:${hashEmail(u.email)}`)).toBeGreaterThan(0);
    expect(await ctx.prisma.user.findUniqueOrThrow({ where: { id: u.id } })).toMatchObject({ emailVerified: false });
  });

  it("locks unknown addresses the same way, so the lock reveals nothing", async () => {
    for (let i = 0; i < 5; i++) await expect(codes.consume(emailOf("unknown"), "123456")).rejects.toMatchObject({ status: 400 });
    await expect(codes.consume(emailOf("unknown"), "123456")).rejects.toMatchObject({ status: 429 });
  });

  it("is atomic: two parallel requests with the right code, exactly one succeeds", async () => {
    const u = await member("7");
    const code = await codes.create(u.id);
    const results = await Promise.allSettled([codes.consume(u.email, code), codes.consume(u.email, code)]);
    expect(results.map((r) => (r.status === "rejected" ? String(r.reason?.message) : r.status))).toContain("fulfilled");
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });

  it("a new code retires the older one", async () => {
    const u = await member("8");
    const first = await codes.create(u.id);
    const second = await codes.create(u.id);
    await expect(codes.consume(u.email, first === second ? "999999" : first)).rejects.toMatchObject({ status: 400 });
    await expect(codes.consume(u.email, second)).resolves.toBe(u.id);
  });

  it("resend: cooldown applies to every address alike; unknown and ineligible accounts get the same silent success", async () => {
    const u = await member("9");
    await ctx.prisma.user.update({ where: { id: u.id }, data: { isApproved: true } });
    const before = ctx.codes.length;
    const ok = await request(ctx.server()).post("/api/auth/resend-email-code").send({ email: u.email }).expect(200);
    expect(ok.body).toEqual({ success: true });
    expect(ctx.codes.length).toBe(before + 1);
    const again = await request(ctx.server()).post("/api/auth/resend-email-code").send({ email: u.email }).expect(429);
    expect(again.body.code).toBe("RATE_LIMITED");
    expect(again.body.message).toMatch(/wait \d+ seconds/);
    // unknown address: same 200 first time, same 429 second time, no email
    const unknown1 = await request(ctx.server()).post("/api/auth/resend-email-code").send({ email: emailOf("unknown") }).expect(200);
    expect(unknown1.body).toEqual(ok.body);
    await request(ctx.server()).post("/api/auth/resend-email-code").send({ email: emailOf("unknown") }).expect(429);
    expect(ctx.codes.length).toBe(before + 1);
  });

  it("the hourly cap stops a flood to one address", async () => {
    await ctx.redis.set(`emailcode:sends:${hashEmail(emailOf("11"))}`, "5", "EX", 3600);
    await expect(codes.assertCanSend(emailOf("11"))).rejects.toMatchObject({ status: 429 });
  });
});

describe("Resend and the DEC-035 switch", () => {
  let ctx: Ctx;
  beforeAll(async () => {
    ctx = await boot();
    await clean(ctx);
  });
  afterAll(async () => {
    await clean(ctx);
    await ctx.app.close();
  });

  it("resend: a pending (unapproved) account is sent nothing while DEC-035 is off, and is once it is on", async () => {
    await register(ctx, "10");
    const u = await ctx.prisma.user.findUniqueOrThrow({ where: { email: emailOf("10") } });
    const before = ctx.codes.length;
    await request(ctx.server()).post("/api/auth/resend-email-code").send({ email: u.email }).expect(200);
    expect(ctx.codes.length).toBe(before);
    await ctx.redis.del(`emailcode:cooldown:${hashEmail(u.email)}`);
    await ctx.prisma.featureFlag.upsert({ where: { key: "onboarding.instant_access" }, update: { enabled: true }, create: { key: "onboarding.instant_access", enabled: true } });
    ctx.flags.invalidate();
    await request(ctx.server()).post("/api/auth/resend-email-code").send({ email: u.email }).expect(200);
    expect(ctx.codes.length).toBe(before + 1);
  });

});

describe("Instant access switch (DEC-035): one flag changes the path", () => {
  let ctx: Ctx;
  beforeAll(async () => {
    ctx = await boot();
    await clean(ctx);
    await ctx.prisma.featureFlag.upsert({ where: { key: "onboarding.instant_access" }, update: { enabled: true }, create: { key: "onboarding.instant_access", enabled: true } });
    ctx.flags.invalidate();
  });
  afterAll(async () => {
    await clean(ctx);
    await ctx.app.close();
  });

  it("registers, receives a code at once, verifies it, is approved and can sign in, then lands in onboarding", async () => {
    const res = await register(ctx, "12");
    expect(res.body.emailCodeSent).toBe(true);
    expect(ctx.codes).toHaveLength(1);
    // before verifying: told to verify, not to wait for an admin
    const blocked = await request(ctx.server()).post("/api/auth/login").send({ email: emailOf("12"), password: PASSWORD }).expect(403);
    expect(blocked.body.reason).toBe("EMAIL_NOT_VERIFIED");
    const code = ctx.codes[ctx.codes.length - 1]!;
    await request(ctx.server()).post("/api/auth/verify-email-code").send({ email: emailOf("12"), code }).expect(200);
    expect(await ctx.prisma.user.findUniqueOrThrow({ where: { email: emailOf("12") } })).toMatchObject({ emailVerified: true, isApproved: true });
    const agent = request.agent(ctx.server());
    const login = await agent.post("/api/auth/login").send({ email: emailOf("12"), password: PASSWORD }).expect(200);
    expect(login.body.user.onboardingComplete).toBe(false);
  });
});

describe("Onboarding (TASK-023, TEST-003)", () => {
  let ctx: Ctx;
  let agent: ReturnType<typeof request.agent>;
  let skillId: string;
  let other: ReturnType<typeof request.agent>;

  beforeAll(async () => {
    ctx = await boot();
    await clean(ctx);
    const signIn = async (name: string) => {
      await register(ctx, name);
      await ctx.prisma.user.update({ where: { email: emailOf(name) }, data: { isApproved: true, emailVerified: true } });
      const a = request.agent(ctx.server());
      await a.post("/api/auth/login").send({ email: emailOf(name), password: PASSWORD }).expect(200);
      return a;
    };
    agent = await signIn("13");
    other = await signIn("14");
    skillId = (
      await ctx.prisma.skill.upsert({
        where: { nameKey: "e2e onboarding skill" },
        update: {},
        create: { name: "E2E Onboarding Skill", nameKey: "e2e onboarding skill", matchKey: "e2eonboardingskill", level: "major" },
      })
    ).id;
  });
  afterAll(async () => {
    await clean(ctx);
    await ctx.prisma.skill.deleteMany({ where: { nameKey: "e2e onboarding skill" } });
    await ctx.app.close();
  });

  const age = (years: number) => {
    const d = new Date();
    d.setUTCFullYear(d.getUTCFullYear() - years);
    return d.toISOString().slice(0, 10);
  };

  it("starts with everything required missing, in the order the flow asks", async () => {
    const res = await agent.get("/api/onboarding").expect(200);
    expect(res.body).toMatchObject({
      complete: false,
      nextStep: "about",
      missing: ["professionalExperience", "dateOfBirth", "targetRole", "careerGoals", "skills"],
    });
  });

  it("refuses to complete and lists what is missing", async () => {
    const res = await agent.post("/api/onboarding/complete").expect(400);
    expect(res.body.message).toMatch(/Experience level.*Date of birth.*role.*goals.*skill/i);
  });

  it("rejects an under-18 date of birth with a field error and stores nothing", async () => {
    const res = await agent.put("/api/onboarding").send({ dateOfBirth: age(17) }).expect(400);
    expect(res.body.fields[0]).toMatchObject({ path: "dateOfBirth" });
    expect(res.body.fields[0].message).toMatch(/18/);
    expect((await agent.get("/api/onboarding").expect(200)).body.values.dateOfBirth).toBeNull();
    await agent.put("/api/onboarding").send({ dateOfBirth: "2999-01-01" }).expect(400);
    await agent.put("/api/onboarding").send({ dateOfBirth: "not-a-date" }).expect(400);
  });

  it("saves in steps, can be resumed, and moves the next step on", async () => {
    await agent.put("/api/onboarding").send({ professionalExperience: "junior", dateOfBirth: age(25) }).expect(200);
    const res = await agent.get("/api/onboarding").expect(200);
    expect(res.body.missing).toEqual(["targetRole", "careerGoals", "skills"]);
    expect(res.body.nextStep).toBe("goals");
    expect(res.body.values.dateOfBirth).toBe(age(25));
    await agent.put("/api/onboarding").send({ targetRole: "Network Engineer", careerGoals: "Get my first NOC role and earn CCNA" }).expect(200);
    expect((await agent.get("/api/onboarding")).body.nextStep).toBe("skills");
  });

  it("WhatsApp is optional: normalised on save, cleared by a blank, and never blocks completion", async () => {
    const set = await agent.put("/api/onboarding").send({ whatsappNumber: "09876543210" }).expect(200);
    expect(set.body.values.whatsappNumber).toBe("+919876543210");
    await agent.put("/api/onboarding").send({ whatsappNumber: "abc" }).expect(400);
    const cleared = await agent.put("/api/onboarding").send({ whatsappNumber: "" }).expect(200);
    expect(cleared.body.values.whatsappNumber).toBeNull();
    expect((await agent.put("/api/onboarding").send({ targetRole: "Network Engineer" }).expect(200)).body.missing).toEqual(["skills"]);
  });

  it("counts skills picked through the existing skill picker, then completes", async () => {
    await agent.put("/api/skills/mine").send({ skills: [{ skillId, visibility: "members" }] }).expect(200);
    const status = (await agent.get("/api/onboarding").expect(200)).body;
    expect(status.missing).toEqual([]);
    expect(status.nextStep).toBe("contact");
    const done = await agent.post("/api/onboarding/complete").expect(200);
    expect(done.body).toMatchObject({ complete: true, nextStep: null });
    expect((await agent.get("/api/auth/me").expect(200)).body.onboardingComplete).toBe(true);
  });

  it("keeps the date of birth private: not in /auth/me, the profile, or another member's view", async () => {
    const me = await agent.get("/api/auth/me").expect(200);
    expect(JSON.stringify(me.body)).not.toContain("dateOfBirth");
    expect(JSON.stringify((await agent.get("/api/users/profile").expect(200)).body)).not.toContain(age(25));
    const meId = me.body.id as string;
    const seen = await other.get(`/api/members/${meId}`).expect(200);
    expect(JSON.stringify(seen.body)).not.toContain("dateOfBirth");
    expect(JSON.stringify(seen.body)).not.toContain(age(25));
    // another member's onboarding is not reachable: the route has no id, it is always the caller's
    expect((await other.get("/api/onboarding").expect(200)).body.values.dateOfBirth).toBeNull();
  });
});
