import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import * as bcrypt from "bcrypt";
import cookieParser from "cookie-parser";
import Redis from "ioredis";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { AuthService } from "../src/modules/identity/application/services/auth.service";
import { TokenService } from "../src/modules/identity/application/services/token.service";
import { REDIS_CLIENT } from "../src/common/redis/redis.constants";
import { acceptedConsents } from "./helpers/consents";

// Regression tests for the defects found in the code review (docs/research/04, findings
// S-1, S-2 and S-3). Each test describes the behaviour we require; they were written to
// fail against the code as reviewed and pass once the fix is in.
describe("Security regressions (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokens: TokenService;
  let auth: AuthService;
  let redis: Redis;

  const PASSWORD = "Passw0rd!23";
  const EMAILS = {
    author: "sec-author@example.com",
    other: "sec-other@example.com",
    reset: "sec-reset@example.com",
    expiry: "sec-expiry@example.com",
    lock: "sec-lock@example.com",
    clear: "sec-clear@example.com",
  };
  const allEmails = Object.values(EMAILS);

  let publishedId: string;
  let draftId: string;

  async function clearOtpCounters() {
    const keys = await redis.keys("pwreset:fail:*");
    if (keys.length > 0) await redis.del(...keys);
  }

  async function cleanup() {
    await prisma.user.deleteMany({ where: { email: { in: allEmails } } });
    await clearOtpCounters();
  }

  async function registerAndActivate(email: string) {
    await request(app.getHttpServer())
      .post("/api/auth/register")
      .send({ firstName: "Sec", lastName: "Test", email, password: PASSWORD, consents: await acceptedConsents(prisma) })
      .expect(201);
    await prisma.user.update({ where: { email }, data: { isApproved: true, emailVerified: true } });
    const agent = request.agent(app.getHttpServer());
    await agent.post("/api/auth/login").send({ email, password: PASSWORD }).expect(200);
    return agent;
  }

  // A user plus a pending 6-digit reset code, created directly so no email is involved.
  async function userWithOtp(email: string) {
    const user = await prisma.user.create({
      data: {
        firstName: "Reset",
        lastName: "Test",
        email,
        passwordHash: await bcrypt.hash("OldPassw0rd!1", 4),
        isApproved: true,
        emailVerified: true,
      },
    });
    const otp = tokens.generateOtp();
    await prisma.passwordReset.create({
      data: { userId: user.id, otpHash: otp.hash, expiresAt: new Date(Date.now() + 10 * 60 * 1000) },
    });
    return { user, otp: otp.plain };
  }

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

  // ---- S-1: draft quizzes must never reach people who may not see them -------------------

  describe("quiz list visibility (S-1)", () => {
    let authorAgent: ReturnType<typeof request.agent>;
    let otherAgent: ReturnType<typeof request.agent>;

    beforeAll(async () => {
      authorAgent = await registerAndActivate(EMAILS.author);
      otherAgent = await registerAndActivate(EMAILS.other);
      const author = await prisma.user.findUniqueOrThrow({ where: { email: EMAILS.author } });
      const category = await prisma.category.findFirstOrThrow();
      const published = await prisma.quiz.create({
        data: { title: "SEC published quiz", description: "visible", categoryId: category.id, createdById: author.id, isPublished: true },
      });
      const draft = await prisma.quiz.create({
        data: { title: "SEC draft quiz", description: "hidden", categoryId: category.id, createdById: author.id, isPublished: false },
      });
      publishedId = published.id;
      draftId = draft.id;
    });

    it("shows an anonymous visitor the published quiz", async () => {
      const res = await request(app.getHttpServer()).get("/api/quizzes?limit=100").expect(200);
      expect(JSON.stringify(res.body)).toContain(publishedId);
    });

    it("does not show an anonymous visitor an unpublished draft", async () => {
      const res = await request(app.getHttpServer()).get("/api/quizzes?limit=100").expect(200);
      expect(JSON.stringify(res.body)).not.toContain(draftId);
    });

    it("does not show another member someone else's draft", async () => {
      const res = await otherAgent.get("/api/quizzes?limit=100").expect(200);
      expect(JSON.stringify(res.body)).toContain(publishedId);
      expect(JSON.stringify(res.body)).not.toContain(draftId);
    });

    it("still shows the author their own draft", async () => {
      const res = await authorAgent.get("/api/quizzes?limit=100").expect(200);
      expect(JSON.stringify(res.body)).toContain(draftId);
    });

    it("returns 404 when an anonymous visitor opens a draft directly", async () => {
      await request(app.getHttpServer()).get(`/api/quizzes/${draftId}`).expect(404);
    });
  });

  // ---- S-2: the password-reset session token is single use and short lived --------------

  describe("password reset session token (S-2)", () => {
    it("lets the token reset the password once, and refuses it afterwards", async () => {
      const { otp } = await userWithOtp(EMAILS.reset);
      const server = app.getHttpServer();

      const verified = await request(server).post("/api/auth/verifyotp").send({ email: EMAILS.reset, otp }).expect(200);
      const tempToken: string = verified.body.tempToken;
      expect(tempToken).toEqual(expect.any(String));

      await request(server).post("/api/auth/resetpassword").send({ tempToken, password: "NewPassw0rd!45" }).expect(200);
      // The password really changed.
      await request(server).post("/api/auth/login").send({ email: EMAILS.reset, password: "NewPassw0rd!45" }).expect(200);

      // Replaying the same token must not reset it again.
      await request(server).post("/api/auth/resetpassword").send({ tempToken, password: "Attacker!Passw0rd9" }).expect(400);
    });

    it("refuses a token whose time has run out", async () => {
      const { otp } = await userWithOtp(EMAILS.expiry);
      const server = app.getHttpServer();

      const verified = await request(server).post("/api/auth/verifyotp").send({ email: EMAILS.expiry, otp }).expect(200);
      const tempToken: string = verified.body.tempToken;

      const id = tempToken.split(".")[0] as string;
      await prisma.passwordReset.update({ where: { id }, data: { expiresAt: new Date(Date.now() - 1000) } });

      await request(server).post("/api/auth/resetpassword").send({ tempToken, password: "NewPassw0rd!45" }).expect(400);
    });
  });

  // ---- S-3: a 6-digit code cannot be guessed by trying again and again --------------------

  describe("reset code guessing (S-3)", () => {
    const wrongCode = (real: string) => (real === "000000" ? "111111" : "000000");

    it("locks the code after five wrong guesses, even if the next guess is right", async () => {
      const { otp } = await userWithOtp(EMAILS.lock);
      // Called on the service directly so the per-IP HTTP limit cannot hide the problem.
      for (let i = 0; i < 5; i++) {
        await expect(auth.verifyOtp(EMAILS.lock, wrongCode(otp))).rejects.toMatchObject({ status: 400 });
      }
      await expect(auth.verifyOtp(EMAILS.lock, otp)).rejects.toMatchObject({ status: 429 });
    });

    it("counts guesses per email even when the account does not exist", async () => {
      for (let i = 0; i < 5; i++) {
        await expect(auth.verifyOtp("sec-nobody@example.com", "123456")).rejects.toMatchObject({ status: 400 });
      }
      // Same answer as for a real account, so the lock does not reveal which emails exist.
      await expect(auth.verifyOtp("sec-nobody@example.com", "123456")).rejects.toMatchObject({ status: 429 });
    });

    it("forgets earlier mistakes after a correct code", async () => {
      const { otp } = await userWithOtp(EMAILS.clear);
      for (let i = 0; i < 3; i++) {
        await expect(auth.verifyOtp(EMAILS.clear, wrongCode(otp))).rejects.toMatchObject({ status: 400 });
      }
      await expect(auth.verifyOtp(EMAILS.clear, otp)).resolves.toHaveProperty("tempToken");
      // The earlier three mistakes no longer count: four more are still answered normally.
      for (let i = 0; i < 4; i++) {
        await expect(auth.verifyOtp(EMAILS.clear, wrongCode(otp))).rejects.toMatchObject({ status: 400 });
      }
    });
  });
});
