import { HttpException, INestApplication, UnauthorizedException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import * as bcrypt from "bcrypt";
import cookieParser from "cookie-parser";
import Redis from "ioredis";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { AuthService } from "../src/modules/identity/application/services/auth.service";
import { TokenService } from "../src/modules/identity/application/services/token.service";
import { REDIS_CLIENT } from "../src/common/redis/redis.constants";

// TEST-007 (session limits, SEC-05) and TEST-013 (per-account login lockout, TASK-013).
// Refresh-token rows are made through TokenService and back-dated with Prisma, so no test waits.
describe("Sessions and login lockout (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokens: TokenService;
  let auth: AuthService;
  let redis: Redis;

  const PASSWORD = "Passw0rd!23";
  const EMAILS = {
    staff: "sess-staff@example.com",
    member: "sess-member@example.com",
    lock: "sess-lock@example.com",
  };
  const UNKNOWN = "sess-nobody@example.com";
  const META = { userAgent: "jest", ipAddress: "127.0.0.1" };
  const MIN = 60_000;
  const ago = (ms: number) => new Date(Date.now() - ms);

  async function clearLoginCounters() {
    const keys = await redis.keys("login:fail:*");
    if (keys.length > 0) await redis.del(...keys);
  }

  async function cleanup() {
    // refresh_tokens cascade with the user
    await prisma.user.deleteMany({ where: { email: { in: Object.values(EMAILS) } } });
    await clearLoginCounters();
  }

  async function makeUser(email: string, roleName: string) {
    const role = await prisma.role.findUniqueOrThrow({ where: { name: roleName } });
    return prisma.user.create({
      data: {
        firstName: "Sess",
        lastName: "Test",
        email,
        passwordHash: await bcrypt.hash(PASSWORD, 4),
        isApproved: true,
        emailVerified: true,
        roles: { create: { roleId: role.id } },
      },
    });
  }

  const idOf = (raw: string) => raw.split(".")[0];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix("api");
    await app.init();
    prisma = app.get(PrismaService);
    tokens = app.get(TokenService);
    auth = app.get(AuthService);
    redis = app.get<Redis>(REDIS_CLIENT);
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  describe("session limits (TEST-007)", () => {
    let staffId: string;
    let memberId: string;

    beforeAll(async () => {
      staffId = (await makeUser(EMAILS.staff, "admin")).id;
      memberId = (await makeUser(EMAILS.member, "member")).id;
    });

    it("a fresh session refreshes normally for staff and members", async () => {
      for (const userId of [staffId, memberId]) {
        const { raw } = await tokens.issueRefreshTokenFamily(userId, META);
        const rotated = await auth.refreshSession(raw, META);
        expect(rotated.refreshToken).toBeTruthy();
        expect(rotated.user.id).toBe(userId);
      }
    });

    it("refuses a staff session idle for more than 30 minutes and revokes the family", async () => {
      const { raw, record } = await tokens.issueRefreshTokenFamily(staffId, META);
      await prisma.refreshToken.update({ where: { id: record.id }, data: { createdAt: ago(31 * MIN) } });
      await expect(auth.refreshSession(raw, META)).rejects.toBeInstanceOf(UnauthorizedException);
      const row = await prisma.refreshToken.findUniqueOrThrow({ where: { id: idOf(raw) } });
      expect(row.revokedAt).not.toBeNull();
    });

    it("accepts a staff session idle for less than 30 minutes", async () => {
      const { raw, record } = await tokens.issueRefreshTokenFamily(staffId, META);
      await prisma.refreshToken.update({ where: { id: record.id }, data: { createdAt: ago(25 * MIN) } });
      await expect(auth.refreshSession(raw, META)).resolves.toBeDefined();
    });

    it("refuses a staff session older than 8 hours even though it is active", async () => {
      const first = await tokens.issueRefreshTokenFamily(staffId, META);
      const second = await tokens.rotateRefreshToken(first.raw, META);
      // First login 9 hours ago, last activity 5 minutes ago.
      await prisma.refreshToken.update({ where: { id: first.record.id }, data: { createdAt: ago(9 * 60 * MIN) } });
      await prisma.refreshToken.update({ where: { id: idOf(second.raw) }, data: { createdAt: ago(5 * MIN) } });
      await expect(auth.refreshSession(second.raw, META)).rejects.toBeInstanceOf(UnauthorizedException);
      const live = await prisma.refreshToken.count({ where: { familyId: first.record.familyId, revokedAt: null } });
      expect(live).toBe(0);
    });

    it("accepts a staff session that is active and under 8 hours old", async () => {
      const first = await tokens.issueRefreshTokenFamily(staffId, META);
      const second = await tokens.rotateRefreshToken(first.raw, META);
      await prisma.refreshToken.update({ where: { id: first.record.id }, data: { createdAt: ago(7 * 60 * MIN) } });
      await prisma.refreshToken.update({ where: { id: idOf(second.raw) }, data: { createdAt: ago(5 * MIN) } });
      await expect(auth.refreshSession(second.raw, META)).resolves.toBeDefined();
    });

    it("refuses a member idle for more than 30 days", async () => {
      const { raw, record } = await tokens.issueRefreshTokenFamily(memberId, META);
      await prisma.refreshToken.update({ where: { id: record.id }, data: { createdAt: ago(31 * 24 * 60 * MIN) } });
      await expect(auth.refreshSession(raw, META)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("accepts a member idle for 29 days, and has no absolute limit", async () => {
      const first = await tokens.issueRefreshTokenFamily(memberId, META);
      const second = await tokens.rotateRefreshToken(first.raw, META);
      await prisma.refreshToken.update({ where: { id: first.record.id }, data: { createdAt: ago(200 * 24 * 60 * MIN) } });
      await prisma.refreshToken.update({ where: { id: idOf(second.raw) }, data: { createdAt: ago(29 * 24 * 60 * MIN) } });
      await expect(auth.refreshSession(second.raw, META)).resolves.toBeDefined();
    });
  });

  describe("login lockout (TEST-013)", () => {
    const attempt = (email: string, password: string) => auth.login({ email, password });
    const statusOf = async (p: Promise<unknown>) => {
      try {
        await p;
        return 200;
      } catch (e) {
        return e instanceof HttpException ? e.getStatus() : 500;
      }
    };

    beforeAll(async () => {
      await makeUser(EMAILS.lock, "member");
    });

    beforeEach(clearLoginCounters);

    it("locks after 5 wrong passwords, even when the next password is right", async () => {
      for (let i = 0; i < 5; i++) expect(await statusOf(attempt(EMAILS.lock, "wrong-password"))).toBe(401);
      expect(await statusOf(attempt(EMAILS.lock, PASSWORD))).toBe(429);
    });

    it("applies the same lock to an unknown email", async () => {
      for (let i = 0; i < 5; i++) expect(await statusOf(attempt(UNKNOWN, "whatever"))).toBe(401);
      expect(await statusOf(attempt(UNKNOWN, "whatever"))).toBe(429);
    });

    it("treats the email case-insensitively", async () => {
      for (let i = 0; i < 5; i++) await statusOf(attempt(EMAILS.lock.toUpperCase(), "wrong-password"));
      expect(await statusOf(attempt(EMAILS.lock, PASSWORD))).toBe(429);
    });

    it("a correct login before the limit clears the counter", async () => {
      for (let i = 0; i < 4; i++) await statusOf(attempt(EMAILS.lock, "wrong-password"));
      expect(await statusOf(attempt(EMAILS.lock, PASSWORD))).toBe(200);
      // Four more failures would have locked the account had the counter not been cleared.
      for (let i = 0; i < 4; i++) expect(await statusOf(attempt(EMAILS.lock, "wrong-password"))).toBe(401);
      expect(await statusOf(attempt(EMAILS.lock, PASSWORD))).toBe(200);
    });

    it("the lock ends when its Redis window ends", async () => {
      for (let i = 0; i < 5; i++) await statusOf(attempt(EMAILS.lock, "wrong-password"));
      expect(await statusOf(attempt(EMAILS.lock, PASSWORD))).toBe(429);
      const [key] = await redis.keys("login:fail:*");
      expect(await redis.ttl(key)).toBeGreaterThan(0);
      expect(await redis.ttl(key)).toBeLessThanOrEqual(15 * 60);
      await redis.del(key);
      expect(await statusOf(attempt(EMAILS.lock, PASSWORD))).toBe(200);
    });
  });
});
