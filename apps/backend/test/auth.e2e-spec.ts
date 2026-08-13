import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

// Regression coverage for the specific bugs found in the old Express/Mongoose backend
// during the migration audit (plan §3) — these are the "non-negotiable gates" before
// Phase 2 starts (implementation plan, Phase 1 step 4/8).
describe("Auth e2e (identity module regressions)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const testEmail = "e2e-regression@example.com";

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix("api");
    await app.init();
    prisma = app.get(PrismaService);
    await prisma.user.deleteMany({ where: { email: testEmail } });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: testEmail } });
    await app.close();
  });

  it("registers a new member as unapproved and unverified", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/auth/register")
      .send({ firstName: "E2E", lastName: "Regression", email: testEmail, password: "Passw0rd!23" })
      .expect(201);

    expect(res.body.isApproved).toBe(false);
    expect(res.body.emailVerified).toBe(false);
    expect(res.body.roles).toEqual(["member"]);
  });

  it("does not rehash the password on an unrelated profile update (old bug regression)", async () => {
    // Approve + verify directly via Prisma to isolate this test from the admin
    // module (not built until Phase 4) and the email-verification token flow
    // (covered separately) — this test is specifically about the hashing bug.
    const before = await prisma.user.findUniqueOrThrow({ where: { email: testEmail } });
    await prisma.user.update({
      where: { email: testEmail },
      data: { isApproved: true, emailVerified: true },
    });

    const agent = request.agent(app.getHttpServer());
    await agent.post("/api/auth/login").send({ email: testEmail, password: "Passw0rd!23" }).expect(200);

    await agent.put("/api/users/profile").send({ bio: "updated via e2e test" }).expect(200);

    const after = await prisma.user.findUniqueOrThrow({ where: { email: testEmail } });
    // The old Mongoose pre-save hook re-hashed the password on every save because it
    // was missing a `return` before the early `next()` — this assertion is exactly
    // the case that bug would have broken.
    expect(after.passwordHash).toBe(before.passwordHash);
    expect(after.bio).toBe("updated via e2e test");
  });

  it("rejects login with an incorrect password", async () => {
    await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: testEmail, password: "WrongPassword!1" })
      .expect(401);
  });

  it("blocks an unapproved user from a guarded route via ApprovedGuard", async () => {
    const unapprovedEmail = "e2e-unapproved@example.com";
    await prisma.user.deleteMany({ where: { email: unapprovedEmail } });

    await request(app.getHttpServer())
      .post("/api/auth/register")
      .send({ firstName: "Un", lastName: "Approved", email: unapprovedEmail, password: "Passw0rd!23" })
      .expect(201);

    const agent = request.agent(app.getHttpServer());
    await agent.post("/api/auth/login").send({ email: unapprovedEmail, password: "Passw0rd!23" }).expect(200);
    await agent.get("/api/users/profile").expect(403);

    await prisma.user.deleteMany({ where: { email: unapprovedEmail } });
  });

  it("rotates the refresh token and revokes the whole family on reuse", async () => {
    const loginRes = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: testEmail, password: "Passw0rd!23" })
      .expect(200);

    const setCookies = loginRes.headers["set-cookie"] as unknown as string[];
    const originalRefreshCookie = setCookies.find((c) => c.startsWith("refreshToken="))?.split(";")[0];
    expect(originalRefreshCookie).toBeDefined();

    // First refresh succeeds and rotates to a new token.
    const refreshRes = await request(app.getHttpServer())
      .post("/api/auth/refresh")
      .set("Cookie", originalRefreshCookie!)
      .expect(200);

    const rotatedCookies = refreshRes.headers["set-cookie"] as unknown as string[];
    const rotatedRefreshCookie = rotatedCookies.find((c) => c.startsWith("refreshToken="))?.split(";")[0];
    expect(rotatedRefreshCookie).toBeDefined();
    expect(rotatedRefreshCookie).not.toBe(originalRefreshCookie);

    // Replaying the pre-rotation refresh token must fail and revoke the family —
    // this is the replay-attack defense the old app's bare re-signed JWT lacked.
    await request(app.getHttpServer())
      .post("/api/auth/refresh")
      .set("Cookie", originalRefreshCookie!)
      .expect(401);

    // The just-rotated token (now part of a family revoked by the reuse above)
    // must also be rejected.
    await request(app.getHttpServer())
      .post("/api/auth/refresh")
      .set("Cookie", rotatedRefreshCookie!)
      .expect(401);
  });
});
