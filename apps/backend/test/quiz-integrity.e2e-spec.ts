import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { QuizzesService } from "../src/modules/quizzes/application/services/quizzes.service";
import { SUBMIT_GRACE_MS } from "../src/modules/quizzes/application/services/quiz-attempts.service";
import { acceptedConsents } from "./helpers/consents";

// TASK-032 / S-7 / S-9 / D-1: attempt cap, retake gap, server-side deadline, quiz expiry,
// and certificates that outlive the quiz that issued them.
describe("Quiz integrity (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const PASSWORD = "Passw0rd!23";
  const EMAILS = { author: "qi-author@example.com", taker: "qi-taker@example.com", other: "qi-other@example.com" };

  let authorId: string;
  let categoryId: string;
  const quizIds: string[] = [];

  async function login(email: string) {
    await request(app.getHttpServer())
      .post("/api/auth/register")
      .send({ firstName: "Qi", lastName: "Test", email, password: PASSWORD, consents: await acceptedConsents(prisma) })
      .expect(201);
    await prisma.user.update({ where: { email }, data: { isApproved: true, emailVerified: true } });
    const agent = request.agent(app.getHttpServer());
    await agent.post("/api/auth/login").send({ email, password: PASSWORD }).expect(200);
    return agent;
  }

  // A one-question quiz; the first option is the correct one.
  async function makeQuiz(data: Record<string, unknown> = {}) {
    const quiz = await prisma.quiz.create({
      data: {
        title: "QI quiz",
        description: "x",
        categoryId,
        createdById: authorId,
        isPublished: true,
        questions: {
          create: [
            {
              questionText: "Pick A",
              questionType: "single_choice",
              options: { create: [{ optionText: "A", isCorrect: true, position: 0 }, { optionText: "B", position: 1 }] },
            },
          ],
        },
        ...data,
      },
      include: { questions: { include: { options: { orderBy: { position: "asc" } } } } },
    });
    quizIds.push(quiz.id);
    return quiz;
  }

  const answersFor = (quiz: Awaited<ReturnType<typeof makeQuiz>>, correct: boolean) => ({
    answers: quiz.questions.map((q) => ({ questionId: q.id, selectedOptionIds: [q.options[correct ? 0 : 1].id] })),
  });

  async function cleanup() {
    await prisma.certificate.deleteMany({ where: { quizId: { in: quizIds } } });
    await prisma.quiz.deleteMany({ where: { id: { in: quizIds } } });
    await prisma.user.deleteMany({ where: { email: { in: Object.values(EMAILS) } } });
  }

  let service: QuizzesService;
  let taker: Awaited<ReturnType<typeof login>>;
  let other: Awaited<ReturnType<typeof login>>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix("api");
    await app.init();
    prisma = app.get(PrismaService);
    service = app.get(QuizzesService);
    await prisma.user.deleteMany({ where: { email: { in: Object.values(EMAILS) } } });
    taker = await login(EMAILS.taker);
    other = await login(EMAILS.other);
    const author = await prisma.user.create({
      data: { firstName: "A", lastName: "B", email: EMAILS.author, passwordHash: "x", isApproved: true, emailVerified: true },
    });
    authorId = author.id;
    categoryId = (await prisma.category.findFirstOrThrow()).id;
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  describe("attempt cap", () => {
    it("allows exactly maxAttempts attempts, then refuses the next with 409", async () => {
      const quiz = await makeQuiz({ maxAttempts: 2 });
      for (let i = 0; i < 2; i++) {
        const start = await taker.post(`/api/quizzes/${quiz.id}/attempts`).expect(201);
        await taker.post(`/api/quizzes/${quiz.id}/attempts/${start.body.id}/submit`).send(answersFor(quiz, false)).expect(201);
      }
      const res = await taker.post(`/api/quizzes/${quiz.id}/attempts`).expect(409);
      expect(res.body.message).toMatch(/all your attempts/);
      expect(await prisma.quizAttempt.count({ where: { quizId: quiz.id } })).toBe(2);
    });

    it("reports remaining attempts in the status block", async () => {
      const quiz = await makeQuiz({ maxAttempts: 3 });
      const start = await taker.post(`/api/quizzes/${quiz.id}/attempts`).expect(201);
      await taker.post(`/api/quizzes/${quiz.id}/attempts/${start.body.id}/submit`).send(answersFor(quiz, false)).expect(201);
      const res = await taker.get(`/api/quizzes/${quiz.id}/attempts/mine`).expect(200);
      expect(res.body.attempts).toHaveLength(1);
      expect(res.body.status).toMatchObject({ maxAttempts: 3, attemptsUsed: 1, attemptsRemaining: 2, canStart: true, blockedReason: null });
    });

    it("counts attempts per member, not per quiz", async () => {
      const quiz = await makeQuiz({ maxAttempts: 1 });
      await taker.post(`/api/quizzes/${quiz.id}/attempts`).expect(201);
      await other.post(`/api/quizzes/${quiz.id}/attempts`).expect(201);
    });

    it("lets an unlimited quiz (maxAttempts null) be retaken freely", async () => {
      const quiz = await makeQuiz({ maxAttempts: null });
      for (let i = 0; i < 4; i++) {
        const start = await taker.post(`/api/quizzes/${quiz.id}/attempts`).expect(201);
        await taker.post(`/api/quizzes/${quiz.id}/attempts/${start.body.id}/submit`).send(answersFor(quiz, false)).expect(201);
      }
      const res = await taker.get(`/api/quizzes/${quiz.id}/attempts/mine`).expect(200);
      expect(res.body.status).toMatchObject({ maxAttempts: null, attemptsRemaining: null, canStart: true });
    });

    it("lets parallel starts create only one attempt and never exceed the cap", async () => {
      const quiz = await makeQuiz({ maxAttempts: 1 });
      const results = await Promise.all([1, 2, 3, 4].map(() => taker.post(`/api/quizzes/${quiz.id}/attempts`)));
      expect(results.every((r) => r.status === 201)).toBe(true);
      expect(new Set(results.map((r) => r.body.id)).size).toBe(1);
      expect(await prisma.quizAttempt.count({ where: { quizId: quiz.id } })).toBe(1);
    });

    it("resumes a running attempt instead of creating another, with the same deadline", async () => {
      const quiz = await makeQuiz({ maxAttempts: 3, timeLimitSeconds: 600 });
      const first = await taker.post(`/api/quizzes/${quiz.id}/attempts`).expect(201);
      const second = await taker.post(`/api/quizzes/${quiz.id}/attempts`).expect(201);
      expect(second.body.id).toBe(first.body.id);
      expect(second.body.deadlineAt).toBe(first.body.deadlineAt);
    });
  });

  describe("retake gap", () => {
    it("refuses a retake inside the gap and reports when it opens", async () => {
      const quiz = await makeQuiz({ retakeGapSeconds: 3600 });
      const start = await taker.post(`/api/quizzes/${quiz.id}/attempts`).expect(201);
      await taker.post(`/api/quizzes/${quiz.id}/attempts/${start.body.id}/submit`).send(answersFor(quiz, false)).expect(201);
      const res = await taker.post(`/api/quizzes/${quiz.id}/attempts`).expect(409);
      expect(res.body.message).toMatch(/retake/);
      const status = (await taker.get(`/api/quizzes/${quiz.id}/attempts/mine`).expect(200)).body.status;
      expect(status).toMatchObject({ canStart: false, blockedReason: "retake_gap" });
      expect(new Date(status.nextAttemptAt).getTime()).toBeGreaterThan(Date.now() + 3500_000);
    });

    it("allows the retake once the gap has passed", async () => {
      const quiz = await makeQuiz({ retakeGapSeconds: 3600 });
      const start = await taker.post(`/api/quizzes/${quiz.id}/attempts`).expect(201);
      await taker.post(`/api/quizzes/${quiz.id}/attempts/${start.body.id}/submit`).send(answersFor(quiz, false)).expect(201);
      await prisma.quizAttempt.update({ where: { id: start.body.id }, data: { submittedAt: new Date(Date.now() - 3601_000) } });
      await taker.post(`/api/quizzes/${quiz.id}/attempts`).expect(201);
    });
  });

  describe("server-side time limit", () => {
    it("stores the deadline at start from the quiz time limit", async () => {
      const quiz = await makeQuiz({ timeLimitSeconds: 600 });
      const res = await taker.post(`/api/quizzes/${quiz.id}/attempts`).expect(201);
      const span = new Date(res.body.deadlineAt).getTime() - new Date(res.body.startedAt).getTime();
      expect(span).toBe(600_000);
    });

    it("has no deadline for an untimed quiz", async () => {
      const quiz = await makeQuiz();
      const res = await taker.post(`/api/quizzes/${quiz.id}/attempts`).expect(201);
      expect(res.body.deadlineAt).toBeNull();
    });

    it("rejects a submission after the deadline, marks it expired and still counts it", async () => {
      const quiz = await makeQuiz({ timeLimitSeconds: 60, maxAttempts: 1 });
      const start = await taker.post(`/api/quizzes/${quiz.id}/attempts`).expect(201);
      await prisma.quizAttempt.update({
        where: { id: start.body.id },
        data: { deadlineAt: new Date(Date.now() - SUBMIT_GRACE_MS - 1000) },
      });
      const res = await taker.post(`/api/quizzes/${quiz.id}/attempts/${start.body.id}/submit`).send(answersFor(quiz, true)).expect(409);
      expect(res.body.message).toMatch(/time limit/);
      const row = await prisma.quizAttempt.findUniqueOrThrow({ where: { id: start.body.id } });
      expect(row.status).toBe("expired");
      expect(row.scorePct).toBeNull();
      expect(await prisma.certificate.count({ where: { quizAttemptId: start.body.id } })).toBe(0);
      // The cap still holds: the expired attempt used the only attempt.
      await taker.post(`/api/quizzes/${quiz.id}/attempts`).expect(409);
    });

    it("accepts a submission inside the grace period after the deadline", async () => {
      const quiz = await makeQuiz({ timeLimitSeconds: 60 });
      const start = await taker.post(`/api/quizzes/${quiz.id}/attempts`).expect(201);
      await prisma.quizAttempt.update({ where: { id: start.body.id }, data: { deadlineAt: new Date(Date.now() - 1000) } });
      await taker.post(`/api/quizzes/${quiz.id}/attempts/${start.body.id}/submit`).send(answersFor(quiz, false)).expect(201);
    });

    it("keeps the deadline fixed when the quiz's time limit is edited mid-attempt", async () => {
      const quiz = await makeQuiz({ timeLimitSeconds: 600 });
      const start = await taker.post(`/api/quizzes/${quiz.id}/attempts`).expect(201);
      await prisma.quiz.update({ where: { id: quiz.id }, data: { timeLimitSeconds: 5 } });
      const mine = await taker.get(`/api/quizzes/${quiz.id}/attempts/mine`).expect(200);
      expect(mine.body.status.inProgress.deadlineAt).toBe(start.body.deadlineAt);
    });

    it("expires an abandoned attempt when the member next looks, and offers a new start", async () => {
      const quiz = await makeQuiz({ timeLimitSeconds: 60, maxAttempts: 2 });
      const start = await taker.post(`/api/quizzes/${quiz.id}/attempts`).expect(201);
      await prisma.quizAttempt.update({
        where: { id: start.body.id },
        data: { deadlineAt: new Date(Date.now() - SUBMIT_GRACE_MS - 1000) },
      });
      const mine = await taker.get(`/api/quizzes/${quiz.id}/attempts/mine`).expect(200);
      expect(mine.body.attempts[0].status).toBe("expired");
      expect(mine.body.status).toMatchObject({ inProgress: null, attemptsRemaining: 1, canStart: true });
      const fresh = await taker.post(`/api/quizzes/${quiz.id}/attempts`).expect(201);
      expect(fresh.body.id).not.toBe(start.body.id);
    });

    it("refuses to submit an attempt that is already expired", async () => {
      const quiz = await makeQuiz({ timeLimitSeconds: 60 });
      const start = await taker.post(`/api/quizzes/${quiz.id}/attempts`).expect(201);
      await prisma.quizAttempt.update({ where: { id: start.body.id }, data: { status: "expired" } });
      await taker.post(`/api/quizzes/${quiz.id}/attempts/${start.body.id}/submit`).send(answersFor(quiz, true)).expect(409);
    });
  });

  describe("quiz expiry", () => {
    it("refuses new attempts after the quiz has expired", async () => {
      const quiz = await makeQuiz({ expiresAt: new Date(Date.now() - 1000) });
      const res = await taker.post(`/api/quizzes/${quiz.id}/attempts`).expect(409);
      expect(res.body.message).toMatch(/closed/);
      const status = (await taker.get(`/api/quizzes/${quiz.id}/attempts/mine`).expect(200)).body.status;
      expect(status).toMatchObject({ canStart: false, blockedReason: "quiz_expired" });
    });

    it("accepts attempts before the expiry moment", async () => {
      const quiz = await makeQuiz({ expiresAt: new Date(Date.now() + 3600_000) });
      await taker.post(`/api/quizzes/${quiz.id}/attempts`).expect(201);
    });

    it("lets an attempt that began before expiry still be submitted", async () => {
      const quiz = await makeQuiz({ expiresAt: new Date(Date.now() + 3600_000) });
      const start = await taker.post(`/api/quizzes/${quiz.id}/attempts`).expect(201);
      await prisma.quiz.update({ where: { id: quiz.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
      await taker.post(`/api/quizzes/${quiz.id}/attempts/${start.body.id}/submit`).send(answersFor(quiz, false)).expect(201);
    });
  });

  describe("quiz policy on the taking view", () => {
    it("exposes the limits, with safe defaults, on the taking view", async () => {
      const quiz = await makeQuiz();
      const view = await request(app.getHttpServer()).get(`/api/quizzes/${quiz.id}`).expect(200);
      expect(view.body).toMatchObject({ maxAttempts: 3, retakeGapSeconds: 0, expiresAt: null });
    });
  });

  describe("certificate retention (S-9, D-1)", () => {
    it("archives instead of deleting a quiz that has issued a certificate, keeping the verifier working", async () => {
      const quiz = await makeQuiz();
      const start = await taker.post(`/api/quizzes/${quiz.id}/attempts`).expect(201);
      const submit = await taker.post(`/api/quizzes/${quiz.id}/attempts/${start.body.id}/submit`).send(answersFor(quiz, true)).expect(201);
      const number = submit.body.certificate.certificateNumber as string;

      // Called through the service as the quiz's owner (the HTTP route additionally needs
      // the quizzes:author permission, which the permission matrix already covers).
      const result = await service.delete(quiz.id, authorId, []);
      expect(result).toEqual({ success: true, archived: true });

      const row = await prisma.quiz.findUniqueOrThrow({ where: { id: quiz.id } });
      expect(row.archivedAt).not.toBeNull();
      expect(row.isPublished).toBe(false);
      expect(await prisma.certificate.count({ where: { quizId: quiz.id } })).toBe(1);
      await request(app.getHttpServer()).get(`/api/quizzes/certificates/verify/${number}`).expect(200);
      await request(app.getHttpServer()).get(`/api/quizzes/${quiz.id}`).expect(404);
      await taker.post(`/api/quizzes/${quiz.id}/attempts`).expect(404);
    });

    it("hard-deletes a quiz with no certificates", async () => {
      const quiz = await makeQuiz();
      expect(await service.delete(quiz.id, authorId, [])).toEqual({ success: true, archived: false });
      expect(await prisma.quiz.findUnique({ where: { id: quiz.id } })).toBeNull();
    });

    it("is enforced by the database too: a raw delete of a quiz with a certificate fails", async () => {
      const quiz = await makeQuiz();
      const start = await taker.post(`/api/quizzes/${quiz.id}/attempts`).expect(201);
      await taker.post(`/api/quizzes/${quiz.id}/attempts/${start.body.id}/submit`).send(answersFor(quiz, true)).expect(201);
      await expect(prisma.quiz.delete({ where: { id: quiz.id } })).rejects.toBeDefined();
      expect(await prisma.certificate.count({ where: { quizId: quiz.id } })).toBe(1);
    });
  });
});
