import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import * as bcrypt from "bcrypt";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

// TASK-005 measurement: the Server-Timing header reports database time, query count and total.
describe("Server-Timing header (e2e)", () => {
  const PASSWORD = "Passw0rd!23";
  const EMAIL = `server-timing-${Date.now()}@example.com`;
  const PATTERN = /^db;dur=(\d+\.\d);desc="(\d+) quer(?:y|ies)", app;dur=(\d+\.\d)$/;

  async function boot() {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix("api");
    await app.init();
    return app;
  }

  describe("enabled", () => {
    let app: INestApplication;
    let prisma: PrismaService;
    let agent: ReturnType<typeof request.agent>;

    beforeAll(async () => {
      delete process.env.SERVER_TIMING; // default: on outside production
      app = await boot();
      prisma = app.get(PrismaService);
      const role = await prisma.role.findUniqueOrThrow({ where: { name: "member" } });
      await prisma.user.create({
        data: {
          firstName: "Timing",
          lastName: "Test",
          email: EMAIL,
          passwordHash: await bcrypt.hash(PASSWORD, 4),
          isApproved: true,
          emailVerified: true,
          roles: { create: { roleId: role.id } },
        },
      });
      agent = request.agent(app.getHttpServer());
      await agent.post("/api/auth/login").send({ email: EMAIL, password: PASSWORD }).expect(200);
    });

    afterAll(async () => {
      await prisma.refreshToken.deleteMany({ where: { user: { email: EMAIL } } });
      await prisma.userRole.deleteMany({ where: { user: { email: EMAIL } } });
      await prisma.user.deleteMany({ where: { email: EMAIL } });
      await app.close();
    });

    it("adds numeric db and app values to a normal route", async () => {
      const res = await request(app.getHttpServer()).get("/api/health");
      const m = PATTERN.exec(String(res.headers["server-timing"]));
      expect(m).not.toBeNull();
      expect(Number(m![3])).toBeGreaterThan(0);
    });

    it("counts the queries of a known route: /api/auth/me makes 2", async () => {
      const res = await agent.get("/api/auth/me").expect(200);
      const m = PATTERN.exec(String(res.headers["server-timing"]));
      expect(m).not.toBeNull();
      expect(m![2]).toBe("2");
      expect(Number(m![1])).toBeGreaterThanOrEqual(0);
    });

    it("does not leak SQL, ids or the email into the header", async () => {
      const res = await agent.get("/api/auth/me").expect(200);
      const header = String(res.headers["server-timing"]);
      expect(header).not.toMatch(/select|from|where|@/i);
    });

    it("is also present on error responses and starts a fresh count per request", async () => {
      const res = await request(app.getHttpServer()).get("/api/auth/me").expect(401);
      const m = PATTERN.exec(String(res.headers["server-timing"]));
      expect(m).not.toBeNull();
      expect(m![2]).toBe("0");
    });
  });

  describe("disabled", () => {
    let app: INestApplication;

    beforeAll(async () => {
      process.env.SERVER_TIMING = "false";
      app = await boot();
    });

    afterAll(async () => {
      delete process.env.SERVER_TIMING;
      await app.close();
    });

    it("sends no Server-Timing header", async () => {
      const res = await request(app.getHttpServer()).get("/api/health");
      expect(res.headers["server-timing"]).toBeUndefined();
    });
  });
});
