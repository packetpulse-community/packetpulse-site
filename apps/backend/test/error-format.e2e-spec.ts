import { Controller, Get, INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { Prisma } from "@prisma/client";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { createHash } from "node:crypto";
import Redis from "ioredis";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { SiteStatusService } from "../src/common/site-status/site-status.service";
import { Public } from "../src/modules/identity";
import { REDIS_CLIENT } from "../src/common/redis/redis.constants";
import { acceptedConsents } from "./helpers/consents";

const SECRET = "SECRET_INTERNAL_DETAIL postgres://user:pw@db/secret";

// Test-only routes that fail in ways real handlers should never expose.
@Controller("e2e-errors")
class BoomController {
  @Public()
  @Get("boom")
  boom() {
    throw new Error(SECRET);
  }

  @Public()
  @Get("prisma-unique")
  prismaUnique() {
    throw new Prisma.PrismaClientKnownRequestError(`Unique constraint failed on the fields: (\`email\`) ${SECRET}`, {
      code: "P2002",
      clientVersion: "x",
      meta: { target: ["email"] },
    });
  }

  @Public()
  @Get("prisma-missing")
  prismaMissing() {
    throw new Prisma.PrismaClientKnownRequestError(`Record to update not found. ${SECRET}`, {
      code: "P2025",
      clientVersion: "x",
    });
  }
}

describe("Error format e2e (TEST-011 / SEC-07)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let siteStatus: SiteStatusService;

  const adminEmail = "e2e-errfmt-admin@example.com";
  const memberEmail = "e2e-errfmt-member@example.com";
  const password = "Passw0rd!23";
  const emails = [adminEmail, memberEmail];

  // Every error body must be exactly this shape, nothing else leaks in.
  function expectShape(body: Record<string, unknown>, status: number, code: string) {
    expect(body.statusCode).toBe(status);
    expect(body.code).toBe(code);
    expect(typeof body.message).toBe("string");
    expect((body.message as string).length).toBeGreaterThan(0);
    const allowed = ["statusCode", "code", "message", "fields", "requestId", "maintenance"];
    expect(Object.keys(body).filter((k) => !allowed.includes(k))).toEqual([]);
    expect(body).not.toHaveProperty("stack");
    expect(body).not.toHaveProperty("error");
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [BoomController],
    }).compile();
    app = moduleRef.createNestApplication();
    app.use(helmet()); // same as main.ts
    app.use(cookieParser());
    app.setGlobalPrefix("api");
    await app.init();
    prisma = app.get(PrismaService);
    siteStatus = app.get(SiteStatusService);

    await prisma.user.deleteMany({ where: { email: { in: emails } } });
    await request(app.getHttpServer())
      .post("/api/auth/register")
      .send({ firstName: "Err", lastName: "Member", email: memberEmail, password, ageConfirmed: true, consents: await acceptedConsents(prisma) })
      .expect(201);
    await prisma.user.update({ where: { email: memberEmail }, data: { isApproved: true, emailVerified: true } });
  });

  afterAll(async () => {
    await prisma.siteSettings.upsert({
      where: { id: "default" },
      update: { maintenanceMode: false },
      create: { id: "default", maintenanceMode: false },
    });
    siteStatus.invalidate();
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
    // The rate-limit test makes failed logins for this address; remove only that lock key so
    // it cannot affect another run (never flush keys we did not create).
    const lockKey = `login:fail:${createHash("sha256").update("nobody@example.com").digest("hex")}`;
    await app.get<Redis>(REDIS_CLIENT).del(lockKey);
    await app.close();
  });

  it("bad registration body -> VALIDATION_FAILED with one field entry per failing path", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/auth/register")
      .send({ firstName: "", email: "not-an-email", password: "x" })
      .expect(400);
    expectShape(res.body, 400, "VALIDATION_FAILED");
    const fields = res.body.fields as { path: string; message: string }[];
    const paths = fields.map((f) => f.path);
    expect(paths).toEqual(expect.arrayContaining(["firstName", "lastName", "email", "password"]));
    expect(new Set(paths).size).toBe(paths.length);
    for (const f of fields) {
      expect(typeof f.message).toBe("string");
      expect(Object.keys(f).sort()).toEqual(["message", "path"]);
    }
  });

  it("unauthenticated -> UNAUTHENTICATED", async () => {
    const res = await request(app.getHttpServer()).get("/api/resources").expect(401);
    expectShape(res.body, 401, "UNAUTHENTICATED");
  });

  it("wrong role -> FORBIDDEN", async () => {
    const member = request.agent(app.getHttpServer());
    await member.post("/api/auth/login").send({ email: memberEmail, password }).expect(200);
    const res = await member.get("/api/admin/users").expect(403);
    expectShape(res.body, 403, "FORBIDDEN");
  });

  it("unknown route -> NOT_FOUND", async () => {
    const res = await request(app.getHttpServer()).get("/api/definitely-not-a-route").expect(404);
    expectShape(res.body, 404, "NOT_FOUND");
  });

  it("registering the same email twice -> CONFLICT", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/auth/register")
      .send({ firstName: "Err", lastName: "Member", email: memberEmail, password, ageConfirmed: true, consents: await acceptedConsents(prisma) })
      .expect(409);
    expectShape(res.body, 409, "CONFLICT");
  });

  it("unexpected error -> INTERNAL_ERROR with no stack, path or internal message", async () => {
    const res = await request(app.getHttpServer()).get("/api/e2e-errors/boom").expect(500);
    expectShape(res.body, 500, "INTERNAL_ERROR");
    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain("SECRET_INTERNAL_DETAIL");
    expect(raw).not.toContain("postgres://");
    expect(raw).not.toMatch(/\bat \S+ \(|\.ts:\d+|node_modules|\/home\//);
  });

  it("Prisma errors map to CONFLICT / NOT_FOUND without model or column names", async () => {
    const dup = await request(app.getHttpServer()).get("/api/e2e-errors/prisma-unique").expect(409);
    expectShape(dup.body, 409, "CONFLICT");
    const missing = await request(app.getHttpServer()).get("/api/e2e-errors/prisma-missing").expect(404);
    expectShape(missing.body, 404, "NOT_FOUND");
    for (const b of [dup.body, missing.body]) {
      const raw = JSON.stringify(b);
      expect(raw).not.toContain("SECRET_INTERNAL_DETAIL");
      expect(raw).not.toContain("email");
      expect(raw).not.toContain("P2002");
    }
  });

  it("maintenance 503 -> MAINTENANCE and still carries maintenance:true", async () => {
    const member = request.agent(app.getHttpServer());
    await member.post("/api/auth/login").send({ email: memberEmail, password }).expect(200);
    await prisma.siteSettings.upsert({
      where: { id: "default" },
      update: { maintenanceMode: true },
      create: { id: "default", maintenanceMode: true },
    });
    siteStatus.invalidate();
    try {
      const res = await member.get("/api/resources").expect(503);
      expectShape(res.body, 503, "MAINTENANCE");
      expect(res.body.maintenance).toBe(true);
    } finally {
      await prisma.siteSettings.update({ where: { id: "default" }, data: { maintenanceMode: false } });
      siteStatus.invalidate();
    }
  });

  it("sends helmet security headers", async () => {
    const res = await request(app.getHttpServer()).get("/api/blogs").expect(200);
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBeDefined();
    expect(res.headers["strict-transport-security"]).toBeDefined();
    expect(res.headers["content-security-policy"]).toBeDefined();
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  // Deliberately LAST: it exhausts the per-IP login limit (and locks the unknown email),
  // so any test that signs in through /api/auth/login after it would get 429 instead of 200.
  it("repeated bad logins -> RATE_LIMITED", async () => {
    let last: request.Response | undefined;
    for (let i = 0; i < 12; i++) {
      last = await request(app.getHttpServer()).post("/api/auth/login").send({ email: "nobody@example.com", password: "wrong-Pass1" });
      if (last.status === 429) break;
    }
    expect(last?.status).toBe(429);
    expectShape(last!.body, 429, "RATE_LIMITED");
  });
});
