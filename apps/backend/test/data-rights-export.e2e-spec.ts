import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { EXPORT_AVAILABLE_DAYS, EXPORT_LINK_TTL_SECONDS } from "@packetpulse/types";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { TokenService } from "../src/modules/identity/application/services/token.service";
import { toPublicUser, userWithRolesInclude } from "../src/modules/identity";
import { StorageProvider } from "../src/common/storage/storage-provider";
import { LocalStorageProvider } from "../src/common/storage/local-storage.provider";
import { FeatureFlagsService } from "../src/modules/feature-flags/feature-flags.service";
import { FLAG_BY_KEY } from "../src/modules/feature-flags/feature-flag.registry";
import { DataExportService } from "../src/modules/data-rights/application/data-export.service";
import { createZip } from "../src/modules/data-rights/application/zip";
import { readZip } from "./helpers/zip-reader";

// TEST-041 (TASK-046, PRD-045): member data export. Real database, Redis and queue worker; local
// storage. Fixtures use a unique prefix; the audit and file access logs are append-only and keep
// their rows, everything else is removed.
jest.setTimeout(120_000);

const PREFIX = "drx-";
const DAY = 24 * 3600_000;

describe("Data export (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let storage: LocalStorageProvider;
  let exportsSvc: DataExportService;
  let flags: FeatureFlagsService;
  const tokens: Record<string, string> = {};
  const ids: Record<string, string> = {};
  const as = (who: string) => ({ Cookie: `accessToken=${tokens[who]}` });

  async function mkUser(name: string, role = "member", extra: object = {}) {
    const user = await prisma.user.create({
      data: {
        firstName: `First${name}`,
        lastName: `Last${name}`,
        email: `${PREFIX}${name}@example.com`,
        isApproved: true,
        emailVerified: true,
        roles: { create: [{ role: { connect: { name: role } } }] },
        ...extra,
      },
      include: userWithRolesInclude,
    });
    ids[name] = user.id;
    tokens[name] = app.get(TokenService).signAccessToken(toPublicUser(user));
    return user;
  }

  async function waitForStatus(who: string, want: string, ms = 20_000) {
    const until = Date.now() + ms;
    for (;;) {
      const res = await request(app.getHttpServer()).get("/api/data-rights").set(as(who));
      if (res.body.export?.status === want) return res.body.export;
      if (Date.now() > until) throw new Error(`export did not reach ${want}: ${JSON.stringify(res.body)}`);
      await new Promise((r) => setTimeout(r, 150));
    }
  }

  async function cleanup() {
    const users = await prisma.user.findMany({ where: { email: { startsWith: PREFIX } }, select: { id: true } });
    const uid = users.map((u) => u.id);
    for (const f of await prisma.storedFile.findMany({ where: { ownerId: { in: uid } } })) await storage.delete(f.bucket, f.path);
    await prisma.dataRequest.deleteMany({ where: { userId: { in: uid } } });
    await prisma.certificate.deleteMany({ where: { userId: { in: uid } } });
    await prisma.quizAttempt.deleteMany({ where: { userId: { in: uid } } });
    await prisma.quiz.deleteMany({ where: { createdById: { in: uid } } });
    await prisma.forumThread.deleteMany({ where: { authorId: { in: uid } } });
    await prisma.blogPost.deleteMany({ where: { authorId: { in: uid } } });
    await prisma.user.deleteMany({ where: { id: { in: uid } } });
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix("api");
    await app.init();
    prisma = app.get(PrismaService);
    storage = app.get(StorageProvider) as LocalStorageProvider;
    exportsSvc = app.get(DataExportService);
    flags = app.get(FeatureFlagsService);
    await cleanup();

    await mkUser("alice", "member", { whatsappNumber: "+919800000001", bio: "ALICE-BIO", careerGoals: "ALICE-GOALS" });
    await mkUser("bravo", "member", { whatsappNumber: "+919800000002", bio: "BRAVO-SECRET-BIO" });
    await mkUser("admin", "admin");
    await mkUser("newbie", "member");

    const category = await prisma.category.findFirstOrThrow();
    const policy = await prisma.consentPolicy.findFirstOrThrow({ where: { purpose: "privacy" } });
    const skill = await prisma.skill.upsert({
      where: { nameKey: "drx-skill" },
      update: {},
      create: { name: "DRX Skill", nameKey: "drx-skill", matchKey: "drxskill", level: "major" },
    });
    const alice = ids.alice;
    const bravo = ids.bravo;

    await prisma.userSocialLinks.create({ data: { userId: alice, github: "https://github.com/alice-drx" } });
    await prisma.userCertification.create({ data: { userId: alice, name: "ALICE-CERT" } });
    await prisma.consentRecord.create({ data: { userId: alice, purpose: "privacy", action: "granted", policyVersion: policy.version, source: "registration" } });
    await prisma.consentRecord.create({ data: { userId: bravo, purpose: "privacy", action: "granted", policyVersion: policy.version, source: "registration" } });
    await prisma.memberSkill.create({ data: { userId: alice, skillId: skill.id } });
    await prisma.memberSkill.create({ data: { userId: bravo, skillId: skill.id } });

    const thread = await prisma.forumThread.create({ data: { categoryId: category.id, authorId: alice, title: "ALICE-THREAD", content: "alice asks", slug: `drx-${randomUUID()}` } });
    await prisma.forumReply.create({ data: { threadId: thread.id, authorId: alice, content: "ALICE-REPLY" } });
    await prisma.forumReply.create({ data: { threadId: thread.id, authorId: bravo, content: "BRAVO-SECRET-REPLY" } });
    await prisma.forumThread.create({ data: { categoryId: category.id, authorId: bravo, title: "BRAVO-SECRET-THREAD", content: "bravo asks", slug: `drx-${randomUUID()}` } });
    await prisma.blogPost.create({ data: { title: "ALICE-BLOG", slug: `drx-${randomUUID()}`, content: "alice writes", authorId: alice, categoryId: category.id } });
    await prisma.blogPost.create({ data: { title: "BRAVO-SECRET-BLOG", slug: `drx-${randomUUID()}`, content: "bravo writes", authorId: bravo, categoryId: category.id } });

    const quiz = await prisma.quiz.create({ data: { title: "DRX-QUIZ", description: "x", categoryId: category.id, createdById: bravo, isPublished: true } });
    const attempt = await prisma.quizAttempt.create({ data: { quizId: quiz.id, userId: alice, status: "submitted", scorePct: 90, passed: true, submittedAt: new Date() } });
    await prisma.certificate.create({ data: { userId: alice, quizId: quiz.id, quizAttemptId: attempt.id, certificateNumber: `DRX-A-${randomUUID()}` } });
    await prisma.quizAttempt.create({ data: { quizId: quiz.id, userId: bravo, status: "submitted", scorePct: 10, passed: false, submittedAt: new Date() } });

    // A notification that names the other member who caused it, and Bravo's own notification.
    await prisma.notification.create({ data: { userId: alice, type: "forum_reply", payload: { threadTitle: "ALICE-THREAD", fromUserId: bravo } } });
    await prisma.notification.create({ data: { userId: bravo, type: "forum_reply", payload: { threadTitle: "BRAVO-SECRET-THREAD" } } });
    await prisma.notificationPreference.create({ data: { userId: alice, eventType: "forum_reply", channel: "email", enabled: true } });
    await prisma.refreshToken.create({ data: { userId: alice, tokenHash: "TOKENHASH-ALICE-SECRET", familyId: randomUUID(), expiresAt: new Date(Date.now() + DAY), ipAddress: "10.0.0.1" } });
    await prisma.storedFile.create({ data: { ownerId: alice, kind: "resume", originalName: "alice-cv.pdf", contentType: "application/pdf", sizeBytes: 10, bucket: "private-files", path: `${alice}/cv.pdf`, status: "available" } });
    await prisma.storedFile.create({ data: { ownerId: bravo, kind: "resume", originalName: "BRAVO-SECRET-CV.pdf", contentType: "application/pdf", sizeBytes: 10, bucket: "private-files", path: `${bravo}/cv.pdf`, status: "available" } });
  });

  afterAll(async () => {
    await prisma.featureFlag.deleteMany({ where: { key: "data_rights.export" } });
    flags.invalidate();
    await cleanup();
    await app.close();
  });

  it("zip writer round-trips file contents", () => {
    const zip = createZip([
      { name: "a.json", data: Buffer.from('{"a":1}') },
      { name: "b/c.txt", data: Buffer.from("héllo ".repeat(500)) },
    ]);
    const files = readZip(zip);
    expect(files["a.json"].toString()).toBe('{"a":1}');
    expect(files["b/c.txt"].toString()).toBe("héllo ".repeat(500));
  });

  describe("request and preparation", () => {
    let requestId: string;
    let zipBytes: Buffer;

    it("needs a session", async () => {
      await request(app.getHttpServer()).post("/api/data-rights/export").expect(401);
      await request(app.getHttpServer()).get("/api/data-rights").expect(401);
    });

    it("a member requests an export, the job prepares it and it becomes ready", async () => {
      const res = await request(app.getHttpServer()).post("/api/data-rights/export").set(as("alice")).expect(201);
      expect(res.body.status).toBe("requested");
      requestId = res.body.id;
      const ready = await waitForStatus("alice", "ready");
      expect(ready.id).toBe(requestId);
      expect(new Date(ready.expiresAt).getTime() - new Date(ready.readyAt).getTime()).toBe(EXPORT_AVAILABLE_DAYS * DAY);
      // The view never carries a path or link.
      expect(JSON.stringify(ready)).not.toMatch(/path|url|bucket|fileId/i);
    });

    it("is stored through the private file pipeline and audited", async () => {
      const row = await prisma.dataRequest.findUniqueOrThrow({ where: { id: requestId }, include: { file: true } });
      expect(row.file).toMatchObject({ kind: "data_export", ownerId: ids.alice, status: "available", contentType: "application/zip", bucket: "private-files" });
      expect((await storage.headObject(row.file!.bucket, row.file!.path)).exists).toBe(true);
      const actions = (await prisma.adminActivityLog.findMany({ where: { targetType: "data_request", targetId: requestId } })).map((a) => a.action);
      expect(actions).toEqual(expect.arrayContaining(["data_export_requested", "data_export_ready"]));
      // The member is told by email through the dispatcher (a delivery record, whatever the transport does).
      const deliveries = await prisma.notificationDelivery.findMany({ where: { userId: ids.alice, eventType: "data_export_ready", channel: "email" } });
      expect(deliveries).toHaveLength(1);
      expect(deliveries[0].critical).toBe(true);
    });

    it("allows one open request per member (409) until it is discarded", async () => {
      await request(app.getHttpServer()).post("/api/data-rights/export").set(as("alice")).expect(409);
      const open = await prisma.dataRequest.count({ where: { userId: ids.alice, kind: "export", activeSlot: { not: null } } });
      expect(open).toBe(1);
    });

    it("hands out a short-lived signed link to the owner only, and logs every one", async () => {
      await request(app.getHttpServer()).post("/api/data-rights/export/link").set(as("bravo")).expect(404);
      await request(app.getHttpServer()).post("/api/data-rights/export/link").set(as("admin")).expect(404);
      const res = await request(app.getHttpServer()).post("/api/data-rights/export/link").set(as("alice")).expect(200);
      expect(res.body.expiresInSeconds).toBe(EXPORT_LINK_TTL_SECONDS);
      zipBytes = await storage.readWithToken(res.body.url);
      expect(zipBytes.subarray(0, 2).toString()).toBe("PK");

      const row = await prisma.dataRequest.findUniqueOrThrow({ where: { id: requestId } });
      const opens = await prisma.fileAccessLog.findMany({ where: { fileId: row.fileId!, action: "open" } });
      expect(opens).toHaveLength(1);
      expect(opens[0].actorId).toBe(ids.alice);
      expect(await prisma.adminActivityLog.count({ where: { action: "data_export_downloaded", targetId: requestId } })).toBe(1);

      // The link stops working after its lifetime (the clock moves, nothing sleeps).
      const second = await request(app.getHttpServer()).post("/api/data-rights/export/link").set(as("alice")).expect(200);
      const real = Date.now;
      Date.now = () => real() + (EXPORT_LINK_TTL_SECONDS + 1) * 1000;
      try {
        await expect(storage.readWithToken(second.body.url)).rejects.toThrow(/expired/);
      } finally {
        Date.now = real;
      }
    });

    it("the general file endpoints never open an export, for the owner or for staff", async () => {
      const row = await prisma.dataRequest.findUniqueOrThrow({ where: { id: requestId } });
      for (const who of ["alice", "admin", "bravo"]) {
        await request(app.getHttpServer()).get(`/api/files/${row.fileId}/link`).set(as(who)).expect(404);
        await request(app.getHttpServer()).delete(`/api/files/${row.fileId}`).set(as(who)).expect(404);
      }
      expect((await prisma.storedFile.findUniqueOrThrow({ where: { id: row.fileId! } })).status).toBe("available");
    });

    it("contains the member's own data and never another member's", () => {
      const files = readZip(zipBytes);
      expect(Object.keys(files).sort()).toEqual(
        ["README.txt", "account.json", "community.json", "consents.json", "content.json", "files.json", "learning.json", "notifications.json", "requests.json", "sessions.json", "skills.json"].sort(),
      );
      const account = JSON.parse(files["account.json"].toString());
      expect(account).toMatchObject({ email: `${PREFIX}alice@example.com`, bio: "ALICE-BIO", careerGoals: "ALICE-GOALS", whatsappNumber: "+919800000001" });
      expect(account.socialLinks.github).toContain("alice-drx");
      expect(account.certifications[0].name).toBe("ALICE-CERT");
      expect(JSON.parse(files["consents.json"].toString())).toHaveLength(1);
      expect(JSON.parse(files["skills.json"].toString())[0].skill).toBe("DRX Skill");
      const community = JSON.parse(files["community.json"].toString());
      expect(community.threads.map((t: { title: string }) => t.title)).toEqual(["ALICE-THREAD"]);
      expect(community.replies.map((r: { content: string }) => r.content)).toEqual(["ALICE-REPLY"]);
      const learning = JSON.parse(files["learning.json"].toString());
      expect(learning.attempts).toHaveLength(1);
      expect(learning.certificates).toHaveLength(1);
      expect(JSON.parse(files["files.json"].toString()).map((f: { originalName: string }) => f.originalName)).toEqual(["alice-cv.pdf"]);
      expect(JSON.parse(files["content.json"].toString()).blogPosts.map((b: { title: string }) => b.title)).toEqual(["ALICE-BLOG"]);
      const notifications = JSON.parse(files["notifications.json"].toString());
      expect(notifications.notifications).toHaveLength(1);
      expect(notifications.preferences).toHaveLength(1);

      // Nothing of Bravo's anywhere in the archive, and no secrets of Alice's.
      const everything = Object.values(files).map((b) => b.toString("utf8")).join("\n");
      for (const secret of ["BRAVO-SECRET", `${PREFIX}bravo`, "Lastbravo", "Firstbravo", ids.bravo, "+919800000002"]) {
        expect(everything).not.toContain(secret);
      }
      for (const secret of ["TOKENHASH-ALICE-SECRET", "passwordHash", "ipHash"]) expect(everything).not.toContain(secret);
    });

    it("running the job again does nothing (idempotent): one file, still ready", async () => {
      expect(await exportsSvc.process(requestId)).toBe("skipped");
      expect(await prisma.storedFile.count({ where: { ownerId: ids.alice, kind: "data_export" } })).toBe(1);
      expect(await prisma.adminActivityLog.count({ where: { action: "data_export_ready", targetId: requestId } })).toBe(1);
    });
  });

  describe("expiry and discard", () => {
    it("an export past its 7 days is removed, audited and lets the member ask again (fake clock)", async () => {
      const row = await prisma.dataRequest.findFirstOrThrow({ where: { userId: ids.alice, kind: "export", status: "ready" }, include: { file: true } });
      expect(await exportsSvc.expireDue(new Date(row.expiresAt!.getTime() - 1000))).toBe(0);
      expect(await exportsSvc.expireDue(new Date(row.expiresAt!.getTime() + 1000))).toBeGreaterThanOrEqual(1);
      const after = await prisma.dataRequest.findUniqueOrThrow({ where: { id: row.id } });
      expect(after).toMatchObject({ status: "expired", activeSlot: null });
      expect((await storage.headObject(row.file!.bucket, row.file!.path)).exists).toBe(false);
      expect(await prisma.storedFile.count({ where: { id: row.fileId! } })).toBe(0);
      expect(await prisma.adminActivityLog.count({ where: { action: "data_export_expired", targetId: row.id } })).toBe(1);
      await request(app.getHttpServer()).post("/api/data-rights/export/link").set(as("alice")).expect(404);
      // Repeating the sweep is harmless.
      expect(await exportsSvc.expireDue(new Date(row.expiresAt!.getTime() + 2000))).toBe(0);
    });

    it("asking for a link on an export whose time ran out closes it instead of serving it", async () => {
      const req = await request(app.getHttpServer()).post("/api/data-rights/export").set(as("alice")).expect(201);
      await waitForStatus("alice", "ready");
      await prisma.dataRequest.update({ where: { id: req.body.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
      await request(app.getHttpServer()).post("/api/data-rights/export/link").set(as("alice")).expect(404);
      expect((await prisma.dataRequest.findUniqueOrThrow({ where: { id: req.body.id } })).status).toBe("expired");
    });

    it("discarding a ready export removes the file and frees the slot", async () => {
      const req = await request(app.getHttpServer()).post("/api/data-rights/export").set(as("alice")).expect(201);
      await waitForStatus("alice", "ready");
      const row = await prisma.dataRequest.findUniqueOrThrow({ where: { id: req.body.id }, include: { file: true } });
      await request(app.getHttpServer()).delete("/api/data-rights/export").set(as("alice")).expect(200);
      expect((await storage.headObject(row.file!.bucket, row.file!.path)).exists).toBe(false);
      expect((await prisma.dataRequest.findUniqueOrThrow({ where: { id: req.body.id } })).status).toBe("cancelled");
      await request(app.getHttpServer()).delete("/api/data-rights/export").set(as("alice")).expect(404);
    });
  });

  describe("failure, switch and scope", () => {
    it("a request the queue gave up on is marked failed and does not block a new one", async () => {
      const row = await prisma.dataRequest.create({ data: { userId: ids.newbie, kind: "export", status: "preparing", activeSlot: "open" } });
      await exportsSvc.fail(row.id, "job_failed");
      expect(await prisma.dataRequest.findUniqueOrThrow({ where: { id: row.id } })).toMatchObject({ status: "failed", activeSlot: null, failureCode: "job_failed" });
      await request(app.getHttpServer()).post("/api/data-rights/export").set(as("newbie")).expect(201);
    });

    it("a stalled request is queued again once, a request out of attempts fails (fake clock)", async () => {
      const stuck = await prisma.dataRequest.create({ data: { userId: ids.bravo, kind: "export", status: "requested", activeSlot: "open", attempts: 1 } });
      const later = new Date(Date.now() + 3600_000);
      expect(await exportsSvc.requeueStalled(later, 15 * 60_000)).toBeGreaterThanOrEqual(1);
      await waitForStatus("bravo", "ready");
      expect((await prisma.dataRequest.findUniqueOrThrow({ where: { id: stuck.id } })).status).toBe("ready");
      const dead = await prisma.dataRequest.create({ data: { userId: ids.admin, kind: "export", status: "requested", activeSlot: "open", attempts: 3 } });
      await exportsSvc.requeueStalled(later, 15 * 60_000);
      expect((await prisma.dataRequest.findUniqueOrThrow({ where: { id: dead.id } })).status).toBe("failed");
    });

    it("the export switch refuses new requests with FEATURE_DISABLED and leaves existing exports alone", async () => {
      await flags.write(FLAG_BY_KEY.get("data_rights.export")!, false, ids.admin);
      try {
        const res = await request(app.getHttpServer()).post("/api/data-rights/export").set(as("alice")).expect(403);
        expect(res.body.code).toBe("FEATURE_DISABLED");
        const overview = await request(app.getHttpServer()).get("/api/data-rights").set(as("alice")).expect(200);
        expect(overview.body.exportEnabled).toBe(false);
      } finally {
        await prisma.featureFlag.deleteMany({ where: { key: "data_rights.export" } });
        flags.invalidate();
      }
    });

    it("every member sees only their own requests", async () => {
      const a = await request(app.getHttpServer()).get("/api/data-rights").set(as("alice")).expect(200);
      const b = await request(app.getHttpServer()).get("/api/data-rights").set(as("newbie")).expect(200);
      const rowsA = await prisma.dataRequest.findMany({ where: { userId: ids.alice } });
      expect(rowsA.map((r) => r.id)).toContain(a.body.export.id);
      expect(rowsA.map((r) => r.id)).not.toContain(b.body.export.id);
    });
  });

  describe("admin visibility", () => {
    it("is refused for a member and read-only for an admin, with audit entries and no file details", async () => {
      await request(app.getHttpServer()).get("/api/admin/data-requests").set(as("alice")).expect(403);
      const res = await request(app.getHttpServer()).get("/api/admin/data-requests?scope=all&limit=100").set(as("admin")).expect(200);
      const mine = res.body.data.find((r: { user: { id: string } }) => r.user.id === ids.alice);
      expect(mine).toBeDefined();
      expect(mine.user.email).toBe(`${PREFIX}alice@example.com`);
      expect(Array.isArray(mine.audit)).toBe(true);
      expect(mine.audit.map((a: { action: string }) => a.action)).toContain("data_export_requested");
      expect(JSON.stringify(res.body)).not.toMatch(/fileId|"path"|"url"|bucket|zip/i);
      // There is no admin route that writes to or opens a request.
      for (const method of ["post", "put", "delete", "patch"] as const) {
        const r = await request(app.getHttpServer())[method]("/api/admin/data-requests").set(as("admin"));
        expect(r.status).toBe(404);
      }
      const open = await request(app.getHttpServer()).get("/api/admin/data-requests").set(as("admin")).expect(200);
      expect(open.body.data.every((r: { status: string }) => ["requested", "preparing", "ready", "scheduled"].includes(r.status))).toBe(true);
    });
  });
});
