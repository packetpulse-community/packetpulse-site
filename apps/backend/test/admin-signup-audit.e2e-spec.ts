import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

// TASK-015 follow-up: creating an admin through the shared-code route writes one audit entry.
// The log is append-only, so the entry stays; the test user is removed (the actor link is
// cleared by the database) and entries are found by the new admin's id.
describe("Admin sign-up audit entry (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const email = `admin-signup-audit-${Date.now()}@example.com`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix("api");
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  it("writes exactly one admin_registered entry with the new admin's id and email", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/auth/register-admin")
      .send({ firstName: "Audit", lastName: "Signup", email, password: "Passw0rd!23", adminSecureCode: process.env.ADMIN_SECURE_CODE })
      .expect(201);
    const id = res.body.id as string;

    const rows = await prisma.adminActivityLog.findMany({ where: { action: "admin_registered", targetId: id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].actorId).toBe(id);
    expect(rows[0].targetType).toBe("user");
    expect((rows[0].details as { email: string }).email).toBe(email);
  });

  it("writes nothing when the admin code is wrong", async () => {
    const before = await prisma.adminActivityLog.count({ where: { action: "admin_registered" } });
    await request(app.getHttpServer())
      .post("/api/auth/register-admin")
      .send({ firstName: "Audit", lastName: "Bad", email: `bad-${email}`, password: "Passw0rd!23", adminSecureCode: "wrong-wrong-wrong-wrong" })
      .expect(401);
    expect(await prisma.adminActivityLog.count({ where: { action: "admin_registered" } })).toBe(before);
  });
});
