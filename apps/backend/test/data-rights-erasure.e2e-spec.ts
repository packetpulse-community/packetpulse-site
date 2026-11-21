import { INestApplication, InternalServerErrorException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import * as bcrypt from "bcrypt";
import { randomUUID } from "node:crypto";
import { DAY_MS, ERASURE_GRACE_DAYS } from "@packetpulse/types";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { TokenService } from "../src/modules/identity/application/services/token.service";
import { toPublicUser, userWithRolesInclude, CredentialProvider } from "../src/modules/identity";
import { LocalCredentialProvider } from "../src/modules/identity/infrastructure/local/local-credential.provider";
import { SupabaseCredentialProvider } from "../src/modules/identity/infrastructure/supabase/supabase-credential.provider";
import { StorageProvider } from "../src/common/storage/storage-provider";
import { LocalStorageProvider } from "../src/common/storage/local-storage.provider";
import { AccountErasureService } from "../src/modules/data-rights/application/account-erasure.service";

// TEST-041 (TASK-046, PRD-045, S-5, D-2): account deletion with a grace period. Real database and
// Redis; local storage; the credential provider is a double that records calls, so the real
// Supabase admin API is never reached. The clock is passed in, never slept on.
jest.setTimeout(120_000);

const PREFIX = "dre-";
const PASSWORD = "Correct-Horse-9!";

// Stands in for the Supabase credential provider: password checks against the local hash, and
// deleteCredential records the call (and can be told to fail once, like a network error).
class RecordingCredentialProvider extends CredentialProvider {
  deleted: string[] = [];
  failNext = false;
  async createCredential() {
    return {};
  }
  async verifyCredential(_email: string, password: string, hash: string | null) {
    await new LocalCredentialProvider().verifyCredential(_email, password, hash);
  }
  async updateCredential() {
    return {};
  }
  async deleteCredential(userId: string) {
    if (this.failNext) {
      this.failNext = false;
      throw new InternalServerErrorException("Supabase Auth: simulated outage");
    }
    this.deleted.push(userId);
  }
}

describe("Account deletion with grace period (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let storage: LocalStorageProvider;
  let erasure: AccountErasureService;
  const creds = new RecordingCredentialProvider();
  const tokens: Record<string, string> = {};
  const ids: Record<string, string> = {};
  const as = (who: string) => ({ Cookie: `accessToken=${tokens[who]}` });
  let hash: string;

  async function mkUser(name: string, role = "member") {
    const user = await prisma.user.create({
      data: {
        firstName: `First${name}`,
        lastName: `Last${name}`,
        email: `${PREFIX}${name}@example.com`,
        passwordHash: hash,
        whatsappNumber: "+919811111111",
        bio: `BIO-${name}`,
        isApproved: true,
        emailVerified: true,
        roles: { create: [{ role: { connect: { name: role } } }] },
      },
      include: userWithRolesInclude,
    });
    ids[name] = user.id;
    tokens[name] = app.get(TokenService).signAccessToken(toPublicUser(user));
    return user;
  }

  async function cleanup() {
    const users = await prisma.user.findMany({ where: { email: { startsWith: PREFIX } }, select: { id: true } });
    const erased = await prisma.user.findMany({ where: { email: { startsWith: "erased-" }, id: { in: Object.values(ids) } }, select: { id: true } });
    const uid = [...users, ...erased].map((u) => u.id);
    for (const f of await prisma.storedFile.findMany({ where: { ownerId: { in: uid } } })) await storage.delete(f.bucket, f.path);
    await prisma.dataRequest.deleteMany({ where: { userId: { in: uid } } });
    await prisma.certificate.deleteMany({ where: { userId: { in: uid } } });
    await prisma.quizAttempt.deleteMany({ where: { userId: { in: uid } } });
    await prisma.quiz.deleteMany({ where: { createdById: { in: uid } } });
    await prisma.forumThread.deleteMany({ where: { authorId: { in: uid } } });
    await prisma.blogPost.deleteMany({ where: { authorId: { in: uid } } });
    await prisma.consentRecord.deleteMany({ where: { userId: { in: uid } } });
    await prisma.user.deleteMany({ where: { id: { in: uid } } });
  }

  // Fills a member with one of everything the erasure table mentions.
  async function seed(name: string) {
    const uid = ids[name];
    const category = await prisma.category.findFirstOrThrow();
    const policy = await prisma.consentPolicy.findFirstOrThrow({ where: { purpose: "privacy" } });
    const skill = await prisma.skill.upsert({ where: { nameKey: "dre-skill" }, update: {}, create: { name: "DRE Skill", nameKey: "dre-skill", matchKey: "dreskill", level: "major" } });
    const other = ids.other;

    await prisma.refreshToken.create({ data: { userId: uid, tokenHash: `h-${randomUUID()}`, familyId: randomUUID(), expiresAt: new Date(Date.now() + DAY_MS) } });
    await prisma.passwordReset.create({ data: { userId: uid, otpHash: "x", expiresAt: new Date(Date.now() + 1000) } });
    await prisma.userSocialLinks.create({ data: { userId: uid, github: "https://github.com/x" } });
    await prisma.userCertification.create({ data: { userId: uid, name: "CERT" } });
    await prisma.profilePrivacy.create({ data: { userId: uid } });
    await prisma.notificationSettings.create({ data: { userId: uid, whatsappNumber: "+919811111111" } });
    await prisma.notificationPreference.create({ data: { userId: uid, eventType: "forum_reply", channel: "email", enabled: true } });
    await prisma.notification.create({ data: { userId: uid, type: "forum_reply", payload: {} } });
    await prisma.memberSkill.create({ data: { userId: uid, skillId: skill.id } });
    await prisma.consentRecord.create({ data: { userId: uid, purpose: "privacy", action: "granted", policyVersion: policy.version, source: "registration" } });
    await prisma.clientLog.create({ data: { level: "error", message: "boom", userId: uid, ip: "1.2.3.4" } });

    const path = `${uid}/cv.pdf`;
    await storage.upload("private-files", path, Buffer.from("%PDF-1.7"), "application/pdf");
    await prisma.storedFile.create({ data: { ownerId: uid, kind: "resume", originalName: "cv.pdf", contentType: "application/pdf", sizeBytes: 8, bucket: "private-files", path, status: "available" } });

    // Content others may depend on.
    const answered = await prisma.forumThread.create({ data: { categoryId: category.id, authorId: uid, title: `ANSWERED-${name}`, content: "q", slug: `dre-${randomUUID()}` } });
    await prisma.forumReply.create({ data: { threadId: answered.id, authorId: other, content: "OTHER-ANSWER" } });
    await prisma.forumThread.create({ data: { categoryId: category.id, authorId: uid, title: `LONELY-${name}`, content: "q", slug: `dre-${randomUUID()}` } });
    const othersThread = await prisma.forumThread.create({ data: { categoryId: category.id, authorId: other, title: `OTHERS-${name}`, content: "q", slug: `dre-${randomUUID()}` } });
    await prisma.forumReply.create({ data: { threadId: othersThread.id, authorId: uid, content: `MY-REPLY-${name}` } });
    await prisma.blogPost.create({ data: { title: `PUBLISHED-${name}`, slug: `dre-${randomUUID()}`, content: "x", authorId: uid, categoryId: category.id } });
    await prisma.blogPost.create({ data: { title: `DRAFT-${name}`, slug: `dre-${randomUUID()}`, content: "x", authorId: uid, categoryId: category.id, isPublished: false } });

    const quiz = await prisma.quiz.create({ data: { title: "DRE-QUIZ", description: "x", categoryId: category.id, createdById: other, isPublished: true } });
    const passed = await prisma.quizAttempt.create({ data: { quizId: quiz.id, userId: uid, status: "submitted", passed: true, scorePct: 90, submittedAt: new Date() } });
    await prisma.quizAttempt.create({ data: { quizId: quiz.id, userId: uid, status: "submitted", passed: false, scorePct: 10, submittedAt: new Date() } });
    const cert = await prisma.certificate.create({ data: { userId: uid, quizId: quiz.id, quizAttemptId: passed.id, certificateNumber: `DRE-${randomUUID()}` } });
    return { certNumber: cert.certificateNumber, quizId: quiz.id };
  }

  beforeAll(async () => {
    hash = await bcrypt.hash(PASSWORD, 4);
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(CredentialProvider).useValue(creds).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix("api");
    await app.init();
    prisma = app.get(PrismaService);
    storage = app.get(StorageProvider) as LocalStorageProvider;
    erasure = app.get(AccountErasureService);
    await cleanup();
    for (const n of ["grace", "full", "retry", "legacy", "other", "admin"]) await mkUser(n, n === "admin" ? "admin" : "member");
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  describe("request and confirmation", () => {
    it("needs the password: a wrong one changes nothing", async () => {
      await request(app.getHttpServer()).post("/api/data-rights/erasure").set(as("grace")).send({}).expect(400);
      const bad = await request(app.getHttpServer()).post("/api/data-rights/erasure").set(as("grace")).send({ password: "wrong" }).expect(400);
      expect(bad.body.message).toMatch(/password/i);
      const user = await prisma.user.findUniqueOrThrow({ where: { id: ids.grace } });
      expect(user.deactivatedAt).toBeNull();
      expect(await prisma.dataRequest.count({ where: { userId: ids.grace } })).toBe(0);
    });

    it("schedules the erasure 30 days out, deactivates the account, revokes sessions and audits it", async () => {
      await prisma.refreshToken.create({ data: { userId: ids.grace, tokenHash: `h-${randomUUID()}`, familyId: randomUUID(), expiresAt: new Date(Date.now() + DAY_MS) } });
      const res = await request(app.getHttpServer()).post("/api/data-rights/erasure").set(as("grace")).send({ password: PASSWORD }).expect(201);
      expect(res.body).toMatchObject({ kind: "erasure", status: "scheduled" });
      const days = (new Date(res.body.scheduledFor).getTime() - new Date(res.body.requestedAt).getTime()) / DAY_MS;
      expect(days).toBe(ERASURE_GRACE_DAYS);

      const user = await prisma.user.findUniqueOrThrow({ where: { id: ids.grace } });
      expect(user.deactivatedAt).not.toBeNull();
      expect(user.erasedAt).toBeNull();
      expect(await prisma.refreshToken.count({ where: { userId: ids.grace, revokedAt: null } })).toBe(0);
      expect(await prisma.adminActivityLog.count({ where: { action: "account_deletion_requested", targetId: ids.grace } })).toBe(1);
      expect(creds.deleted).not.toContain(ids.grace); // nothing is erased yet
      expect(await prisma.notificationDelivery.count({ where: { userId: ids.grace, eventType: "account_deletion" } })).toBe(1);
    });

    it("a second request is refused, one open request per member", async () => {
      await request(app.getHttpServer()).post("/api/data-rights/erasure").set(as("grace")).send({ password: PASSWORD }).expect(409);
    });

    it("while deactivated the account works only for the pages that opt in", async () => {
      const blocked = await request(app.getHttpServer()).get("/api/notifications").set(as("grace")).expect(403);
      expect(blocked.body.reason).toBe("ACCOUNT_DEACTIVATED");
      await request(app.getHttpServer()).put("/api/users/profile").set(as("grace")).send({ bio: "x" }).expect(403);
      await request(app.getHttpServer()).get("/api/data-rights").set(as("grace")).expect(200);
      await request(app.getHttpServer()).get("/api/auth/me").set(as("grace")).expect(200);
      await request(app.getHttpServer()).get("/api/users/profile").set(as("grace")).expect(200);
    });

    it("cancelling within the window reactivates the account and audits it", async () => {
      await request(app.getHttpServer()).delete("/api/data-rights/erasure").set(as("grace")).expect(200);
      const user = await prisma.user.findUniqueOrThrow({ where: { id: ids.grace } });
      expect(user.deactivatedAt).toBeNull();
      const row = await prisma.dataRequest.findFirstOrThrow({ where: { userId: ids.grace, kind: "erasure" } });
      expect(row).toMatchObject({ status: "cancelled", activeSlot: null });
      expect(await prisma.adminActivityLog.count({ where: { action: "account_deletion_cancelled", targetId: ids.grace } })).toBe(1);
      await request(app.getHttpServer()).get("/api/notifications").set(as("grace")).expect(200);
      await request(app.getHttpServer()).delete("/api/data-rights/erasure").set(as("grace")).expect(404);
      // A cancelled request is never erased, however late the job runs.
      expect(await erasure.erase(row.id, new Date(Date.now() + 90 * DAY_MS))).toBe("skipped");
      expect((await prisma.user.findUniqueOrThrow({ where: { id: ids.grace } })).erasedAt).toBeNull();
      // And the member can ask again.
      await request(app.getHttpServer()).post("/api/data-rights/erasure").set(as("grace")).send({ password: PASSWORD }).expect(201);
      await request(app.getHttpServer()).delete("/api/data-rights/erasure").set(as("grace")).expect(200);
    });

    it("the old delete route now schedules instead of deleting at once", async () => {
      await request(app.getHttpServer()).delete("/api/users/profile").set(as("legacy")).send({ password: PASSWORD }).expect(200);
      expect(await prisma.user.count({ where: { id: ids.legacy } })).toBe(1);
      expect(await prisma.dataRequest.count({ where: { userId: ids.legacy, kind: "erasure", status: "scheduled" } })).toBe(1);
      expect(creds.deleted).not.toContain(ids.legacy);
    });
  });

  describe("the erasure job", () => {
    let requestId: string;
    let certNumber: string;
    let seedInfo: { certNumber: string; quizId: string };

    beforeAll(async () => {
      seedInfo = await seed("full");
      certNumber = seedInfo.certNumber;
      // Requested 29 days ago in the fake clock: due in one more day.
      const now = Date.now();
      const view = await erasure.request(ids.full, PASSWORD, new Date(now - 29 * DAY_MS));
      requestId = view.id;
    });

    it("does nothing before the grace period ends (fake clock)", async () => {
      expect(await erasure.erase(requestId, new Date())).toBe("skipped");
      expect((await prisma.user.findUniqueOrThrow({ where: { id: ids.full } })).erasedAt).toBeNull();
      expect(creds.deleted).not.toContain(ids.full);
      expect(await erasure.enqueueDue(new Date())).toBeGreaterThanOrEqual(0);
    });

    it("erases after the grace period: login removed, personal data gone, shared content kept without the name", async () => {
      const due = new Date(Date.now() + 2 * DAY_MS);
      expect(await erasure.erase(requestId, due)).toBe("erased");

      // S-5: the login is removed through the provider, once.
      expect(creds.deleted.filter((id) => id === ids.full)).toHaveLength(1);

      // Tombstone: no personal data, cannot sign in, email free to register again.
      const t = await prisma.user.findUniqueOrThrow({ where: { id: ids.full } });
      expect(t).toMatchObject({ firstName: "Deleted", lastName: "member", passwordHash: null, whatsappNumber: null, bio: null, isApproved: false, emailVerified: false, deactivatedAt: null });
      expect(t.email).toBe(`erased-${ids.full}@erased.invalid`);
      expect(t.erasedAt).toEqual(due);
      await prisma.user.create({ data: { firstName: "New", lastName: "Person", email: `${PREFIX}full@example.com` } }).then((u) => prisma.user.delete({ where: { id: u.id } }));

      // Deleted.
      const own = { userId: ids.full };
      expect(await prisma.refreshToken.count({ where: own })).toBe(0);
      expect(await prisma.passwordReset.count({ where: own })).toBe(0);
      expect(await prisma.userRole.count({ where: own })).toBe(0);
      expect(await prisma.userSocialLinks.count({ where: own })).toBe(0);
      expect(await prisma.userCertification.count({ where: own })).toBe(0);
      expect(await prisma.profilePrivacy.count({ where: own })).toBe(0);
      expect(await prisma.notificationSettings.count({ where: own })).toBe(0);
      expect(await prisma.notificationPreference.count({ where: own })).toBe(0);
      expect(await prisma.notification.count({ where: own })).toBe(0);
      expect(await prisma.notificationDelivery.count({ where: own })).toBe(0);
      expect(await prisma.memberSkill.count({ where: own })).toBe(0);
      expect(await prisma.storedFile.count({ where: { ownerId: ids.full } })).toBe(0);
      expect((await storage.headObject("private-files", `${ids.full}/cv.pdf`)).exists).toBe(false);
      expect(await prisma.forumThread.count({ where: { authorId: ids.full, title: "LONELY-full" } })).toBe(0);
      expect(await prisma.blogPost.count({ where: { authorId: ids.full, title: "DRAFT-full" } })).toBe(0);
      expect(await prisma.quizAttempt.count({ where: { userId: ids.full, certificate: null } })).toBe(0);
      const log = await prisma.clientLog.findFirstOrThrow({ where: { message: "boom", userId: null, ip: null } });
      expect(log).toBeDefined();
      await prisma.clientLog.delete({ where: { id: log.id } });

      // Kept (D-2): other members' content and the thread they replied in.
      expect(await prisma.forumThread.count({ where: { authorId: ids.full, title: "ANSWERED-full" } })).toBe(1);
      expect(await prisma.forumReply.count({ where: { content: "OTHER-ANSWER", authorId: ids.other } })).toBeGreaterThanOrEqual(1);
      expect(await prisma.forumReply.count({ where: { content: "MY-REPLY-full", authorId: ids.full } })).toBe(1);
      expect(await prisma.blogPost.count({ where: { authorId: ids.full, title: "PUBLISHED-full" } })).toBe(1);

      // Kept: the certificate still verifies, with no name; consent and audit proof stay.
      const verified = await request(app.getHttpServer()).get(`/api/quizzes/certificates/verify/${certNumber}`).expect(200);
      expect(verified.body.user).toEqual({ firstName: "Deleted", lastName: "member" });
      expect(await prisma.consentRecord.count({ where: own })).toBe(1);
      const audits = (await prisma.adminActivityLog.findMany({ where: { targetId: ids.full } })).map((a) => a.action);
      expect(audits).toEqual(expect.arrayContaining(["account_deletion_requested", "account_erased"]));
      expect(await prisma.dataRequest.findUniqueOrThrow({ where: { id: requestId } })).toMatchObject({ status: "completed", activeSlot: null });
    });

    it("the old session stops working at once", async () => {
      await request(app.getHttpServer()).get("/api/notifications").set(as("full")).expect(401);
      await request(app.getHttpServer()).get("/api/data-rights").set(as("full")).expect(401);
    });

    it("another member's data is untouched", async () => {
      const other = await prisma.user.findUniqueOrThrow({ where: { id: ids.other } });
      expect(other).toMatchObject({ firstName: "Firstother", bio: "BIO-other", erasedAt: null });
      expect(await prisma.forumThread.count({ where: { authorId: ids.other, title: "OTHERS-full" } })).toBe(1);
    });

    it("running it again does nothing (idempotent)", async () => {
      expect(await erasure.erase(requestId, new Date(Date.now() + 40 * DAY_MS))).toBe("skipped");
      expect(creds.deleted.filter((id) => id === ids.full)).toHaveLength(1);
      expect(await prisma.adminActivityLog.count({ where: { action: "account_erased", targetId: ids.full } })).toBe(1);
    });
  });

  describe("failure and retry", () => {
    it("when removing the login fails nothing is erased, and the retry completes it", async () => {
      const view = await erasure.request(ids.retry, PASSWORD, new Date(Date.now() - 31 * DAY_MS));
      creds.failNext = true;
      await expect(erasure.erase(view.id, new Date())).rejects.toThrow(/simulated outage/);
      const mid = await prisma.user.findUniqueOrThrow({ where: { id: ids.retry } });
      expect(mid).toMatchObject({ firstName: "Firstretry", erasedAt: null });
      expect(mid.deactivatedAt).not.toBeNull();
      expect(await prisma.dataRequest.findUniqueOrThrow({ where: { id: view.id } })).toMatchObject({ status: "scheduled", startedAt: null });

      expect(await erasure.erase(view.id, new Date())).toBe("erased");
      expect(creds.deleted.filter((id) => id === ids.retry)).toHaveLength(1);
      expect((await prisma.user.findUniqueOrThrow({ where: { id: ids.retry } })).erasedAt).not.toBeNull();
    });

    it("a claim left by a crashed run is taken back by the sweep after an hour (fake clock)", async () => {
      const t0 = new Date();
      const row = await prisma.dataRequest.create({
        data: { userId: ids.admin, kind: "erasure", status: "scheduled", activeSlot: "open", scheduledFor: new Date(t0.getTime() - DAY_MS), startedAt: t0 },
      });
      expect(await erasure.erase(row.id, new Date(t0.getTime() + 60_000))).toBe("skipped"); // still claimed
      expect(await erasure.erase(row.id, new Date(t0.getTime() + 61 * 60_000))).toBe("erased");
    });
  });

  describe("supabase mode", () => {
    it("deletes the Supabase auth user by id, and a user that is already gone is a success", async () => {
      const calls: string[] = [];
      const make = (error: { message: string; status?: number } | null) =>
        new SupabaseCredentialProvider({ auth: { admin: { deleteUser: async (id: string) => (calls.push(id), { error }) } } } as never);
      await make(null).deleteCredential("u-1");
      await make({ message: "User not found", status: 404 }).deleteCredential("u-2");
      expect(calls).toEqual(["u-1", "u-2"]);
      await expect(make({ message: "boom", status: 500 }).deleteCredential("u-3")).rejects.toThrow(/failed to delete user/);
    });

    it("docker mode uses the local provider, whose delete never calls Supabase", async () => {
      await expect(new LocalCredentialProvider().deleteCredential()).resolves.toBeUndefined();
    });
  });
});
