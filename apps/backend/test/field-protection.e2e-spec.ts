import { INestApplication, RequestMethod } from "@nestjs/common";
import { DiscoveryService, MetadataScanner } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import { randomUUID } from "crypto";
import request from "supertest";
import { FIELD_POLICY, FieldPolicyEntry } from "@packetpulse/types";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { TokenService } from "../src/modules/identity/application/services/token.service";
import { toPublicUser, userWithRolesInclude } from "../src/modules/identity";
import { applyFieldPolicy } from "../src/common/field-policy";

// TASK-012 / TEST-034 / SEC-02. Sensitive fields are returned only to allowed roles and
// relationships. Every GET route is discovered from the live Nest router (same approach as
// permission-matrix.e2e-spec.ts) and called as ordinary approved non-admin accounts; no
// response may contain another account's email, phone number, last login, token hash,
// IP address or user agent, either as a known value or as a key.

jest.setTimeout(120_000);

const PREFIX = "fp-";
const SECRET = {
  authorEmail: `${PREFIX}author-secret@example.com`,
  replierEmail: `${PREFIX}replier-secret@example.com`,
  authorPhone: "+91 98765 43210",
  replierPhone: "+91 91234 56789",
  ip: "203.0.113.77",
  userAgent: "FieldProtectionSecretAgent/9.9",
  lastLogin: new Date("2026-03-04T05:06:07.089Z"),
};

// Keys that may never appear in any response to a non-admin, whoever they describe.
const FORBIDDEN_KEYS = ["passwordHash", "tokenHash", "ipAddress", "userAgent", "lastLoginAt", "approvedById", "ip"];
// Keys that may appear only with the viewer's own value.
const OWN_ONLY_KEYS = ["email", "whatsappNumber"];

function walk(value: unknown, visit: (key: string, val: unknown, path: string) => void, path = "$"): void {
  if (Array.isArray(value)) value.forEach((v, i) => walk(v, visit, `${path}[${i}]`));
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      visit(k, v, `${path}.${k}`);
      walk(v, visit, `${path}.${k}`);
    }
  }
}

describe("Field-level protection (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokens: TokenService;
  const tokenByActor: Record<string, string> = {};
  const ownByActor: Record<string, { email: string; phone: string }> = {};
  const ids: Record<string, string> = {};
  let getRoutes: { path: string; handler: string }[] = [];
  let foreignValues: string[] = [];

  async function createUser(name: string, role: string, extra: Record<string, unknown> = {}) {
    const phone = `+91 7000${Math.floor(100000 + Math.random() * 899999)}`;
    const email = `${PREFIX}${name}@example.com`;
    const user = await prisma.user.create({
      data: {
        firstName: "Field",
        lastName: name,
        email,
        whatsappNumber: phone,
        isApproved: true,
        emailVerified: true,
        roles: { create: [{ role: { connect: { name: role } } }] },
        ...extra,
      },
      include: userWithRolesInclude,
    });
    tokenByActor[name] = tokens.signAccessToken(toPublicUser(user));
    ownByActor[name] = { email, phone };
    return user;
  }

  async function cleanup() {
    const users = await prisma.user.findMany({ where: { email: { startsWith: PREFIX } }, select: { id: true } });
    const userIds = users.map((u) => u.id);
    await prisma.clientLog.deleteMany({ where: { message: { startsWith: PREFIX } } });
    await prisma.certificate.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.quizAttempt.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.quiz.deleteMany({ where: { createdById: { in: userIds } } });
    await prisma.forumThread.deleteMany({ where: { authorId: { in: userIds } } });
    await prisma.blogPost.deleteMany({ where: { authorId: { in: userIds } } });
    await prisma.resource.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.recording.deleteMany({ where: { instructorId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix("api");
    await app.init();
    prisma = app.get(PrismaService);
    tokens = app.get(TokenService);

    const discovery = app.get(DiscoveryService);
    const scanner = app.get(MetadataScanner);
    for (const wrapper of discovery.getControllers()) {
      if (!wrapper.instance || !wrapper.metatype) continue;
      const proto = Object.getPrototypeOf(wrapper.instance);
      const controllerPath = Reflect.getMetadata("path", wrapper.metatype);
      for (const name of scanner.getAllMethodNames(proto)) {
        const handler = proto[name];
        const methodPath = Reflect.getMetadata("path", handler);
        if (methodPath === undefined || Reflect.getMetadata("method", handler) !== RequestMethod.GET) continue;
        getRoutes.push({
          path: ("/api/" + controllerPath + "/" + methodPath).replace(/\/+/g, "/").replace(/(.)\/$/, "$1"),
          handler: `${wrapper.metatype.name}.${name}`,
        });
      }
    }

    await cleanup();
    const category = (await prisma.category.findFirst()) ?? (await prisma.category.create({ data: { name: "FP cat", slug: `${PREFIX}cat-${randomUUID()}` } }));

    const author = await createUser("author-secret", "member", { lastLoginAt: SECRET.lastLogin });
    const replier = await createUser("replier-secret", "member", { lastLoginAt: SECRET.lastLogin });
    const approver = await createUser("approver-secret", "admin");
    await prisma.user.update({ where: { id: author.id }, data: { approvedById: approver.id, approvedAt: SECRET.lastLogin } });
    await createUser("member", "member");
    await createUser("moderator", "moderator");
    await createUser("instructor", "instructor");
    await createUser("admin", "admin");
    ids.author = author.id;

    await prisma.refreshToken.create({
      data: {
        userId: author.id,
        tokenHash: "fp-token-hash-secret",
        familyId: randomUUID(),
        expiresAt: new Date(Date.now() + 3600_000),
        userAgent: SECRET.userAgent,
        ipAddress: SECRET.ip,
      },
    });
    await prisma.clientLog.create({
      data: { level: "error", message: `${PREFIX}client log`, userId: author.id, ip: SECRET.ip, userAgent: SECRET.userAgent },
    });

    const thread = await prisma.forumThread.create({
      data: { categoryId: category.id, authorId: author.id, title: "FP thread", content: "body", slug: `${PREFIX}thread-${randomUUID()}` },
    });
    ids.thread = thread.id;
    const reply = await prisma.forumReply.create({ data: { threadId: thread.id, authorId: replier.id, content: "reply" } });
    await prisma.forumReply.create({ data: { threadId: thread.id, authorId: author.id, content: "nested", parentReplyId: reply.id } });

    const blog = await prisma.blogPost.create({
      data: { title: "FP blog", slug: `${PREFIX}blog-${randomUUID()}`, content: "body", authorId: author.id, categoryId: category.id },
    });
    ids.blog = blog.id;
    ids.slug = blog.slug;
    await prisma.blogComment.create({ data: { blogPostId: blog.id, userId: replier.id, content: "comment" } });
    await prisma.blogLike.create({ data: { blogPostId: blog.id, userId: replier.id } });

    ids.resource = (
      await prisma.resource.create({
        data: { title: "FP resource", description: "d", resourceType: "article", categoryId: category.id, userId: author.id },
      })
    ).id;
    const recording = await prisma.recording.create({
      data: { title: "FP rec", description: "d", recordingUrl: "https://example.com/r", categoryId: category.id, instructorId: author.id },
    });
    ids.recording = recording.id;
    await prisma.recordingParticipant.create({ data: { recordingId: recording.id, userId: replier.id } });

    const quiz = await prisma.quiz.create({
      data: {
        title: "FP quiz",
        description: "d",
        categoryId: category.id,
        createdById: author.id,
        isPublished: true,
        questions: { create: [{ questionText: "Q?", questionType: "single_choice", position: 0, options: { create: [{ optionText: "a", isCorrect: true, position: 0 }] } }] },
      },
    });
    ids.quiz = quiz.id;
    for (const [who, number] of [[author.id, `FP-CERT-${randomUUID().slice(0, 8)}`], [(await prisma.user.findUniqueOrThrow({ where: { email: ownByActor.member.email } })).id, `FP-OWN-${randomUUID().slice(0, 8)}`]] as const) {
      const attempt = await prisma.quizAttempt.create({
        data: { quizId: quiz.id, userId: who, status: "submitted", scorePct: 100, passed: true, submittedAt: new Date() },
      });
      await prisma.certificate.create({ data: { userId: who, quizId: quiz.id, quizAttemptId: attempt.id, certificateNumber: number } });
      if (who === author.id) {
        ids.certificate = number;
        ids.attempt = attempt.id;
      } else ids.ownCertificate = number;
    }

    // Every known value of every account other than the viewer, which must never leak.
    foreignValues = [SECRET.authorEmail, SECRET.replierEmail, SECRET.authorPhone, SECRET.replierPhone, SECRET.ip, SECRET.userAgent, SECRET.lastLogin.toISOString(), "fp-token-hash-secret"];
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  function resolve(path: string): string {
    const first = path.split("/")[2];
    const sub = path.split("/")[3];
    const idFor: Record<string, string> = {
      blogs: ids.blog,
      forums: ids.thread,
      resources: ids.resource,
      recordings: ids.recording,
      quizzes: ids.quiz,
    };
    return path
      .replace(":certificateNumber", ids.certificate)
      .replace(":slug", ids.slug)
      .replace(":attemptId", ids.attempt)
      .replace(":id", first === "admin" && sub === "users" ? ids.author : (idFor[first] ?? randomUUID()))
      .replace(/:\w+/g, () => randomUUID());
  }

  async function call(path: string, actor?: string) {
    let req = request(app.getHttpServer()).get(resolve(path));
    if (actor) req = req.set("Cookie", `accessToken=${tokenByActor[actor]}`);
    return req;
  }

  it("discovers GET routes (guards the sweep against silently testing nothing)", () => {
    expect(getRoutes.length).toBeGreaterThan(25);
    for (const p of ["/api/forums/threads/:id", "/api/blogs/:id", "/api/quizzes/certificates/verify/:certificateNumber", "/api/auth/me"]) {
      expect(getRoutes.map((r) => r.path)).toContain(p);
    }
  });

  describe.each(["member", "moderator", "instructor", "anonymous"])("as %s", (actor) => {
    it("no GET response contains another account's sensitive values or sensitive keys", async () => {
      const own = ownByActor[actor];
      const problems: string[] = [];
      for (const route of getRoutes) {
        const res = await call(route.path, actor === "anonymous" ? undefined : actor);
        const text = JSON.stringify(res.body);
        for (const value of foreignValues) {
          if (text.includes(value)) problems.push(`${route.path} (${res.status}) contains value ${value}`);
        }
        walk(res.body, (key, val, path) => {
          if (FORBIDDEN_KEYS.includes(key)) problems.push(`${route.path} has key ${path}`);
          if (OWN_ONLY_KEYS.includes(key) && typeof val === "string" && val !== own?.email && val !== own?.phone) {
            problems.push(`${route.path} has ${path}=${val}`);
          }
        });
      }
      expect(problems).toEqual([]);
    });
  });

  describe("own data is still returned where it is meant to be", () => {
    it("GET /auth/me and /users/profile return the caller's own email", async () => {
      for (const path of ["/api/auth/me", "/api/users/profile"]) {
        const res = await call(path, "member");
        expect(res.status).toBe(200);
        const body = res.body.user ?? res.body;
        expect(body.email).toBe(ownByActor.member.email);
      }
    });

    it("GET /quizzes/certificates/mine returns the caller's own certificate", async () => {
      const res = await call("/api/quizzes/certificates/mine", "member");
      expect(res.status).toBe(200);
      expect(JSON.stringify(res.body)).toContain(ids.ownCertificate);
    });

    it("public certificate verification still names the holder, quiz and number", async () => {
      const res = await call("/api/quizzes/certificates/verify/:certificateNumber");
      expect(res.status).toBe(200);
      const text = JSON.stringify(res.body);
      expect(text).toContain(ids.certificate);
      expect(text).toContain("FP quiz");
      expect(text).toContain("Field");
    });

    it("forum thread detail still shows author and replier names", async () => {
      const res = await call("/api/forums/threads/:id", "member");
      expect(res.status).toBe(200);
      expect(JSON.stringify(res.body)).toContain("replier-secret");
    });
  });

  describe("public responses expose only what the page needs", () => {
    it("certificate verification returns holder name, quiz title, number and issue date only", async () => {
      const res = await call("/api/quizzes/certificates/verify/:certificateNumber");
      expect(res.status).toBe(200);
      expect(Object.keys(res.body).sort()).toEqual(["certificateNumber", "issuedAt", "quiz", "user"]);
      expect(Object.keys(res.body.quiz)).toEqual(["title"]);
      expect(Object.keys(res.body.user).sort()).toEqual(["firstName", "lastName"]);
    });

    it("POST /logs does not echo the stored row (IP, user agent, user id) back to the caller", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/logs")
        .set("User-Agent", SECRET.userAgent)
        .send({ level: "info", message: `${PREFIX}echo check` });
      expect(res.status).toBeLessThan(300);
      const text = JSON.stringify(res.body);
      expect(text).not.toContain(SECRET.userAgent);
      walk(res.body, (key) => expect(["ip", "userAgent", "userId", "data"]).not.toContain(key));
    });
  });

  describe("admins keep what the admin screens use", () => {
    it("GET /admin/users lists email and lastLoginAt", async () => {
      const res = await call("/api/admin/users?limit=100", "admin");
      expect(res.status).toBe(200);
      const text = JSON.stringify(res.body);
      expect(text).toContain(SECRET.authorEmail);
      expect(text).toContain(SECRET.lastLogin.toISOString());
    });

    it("ordinary members cannot call the admin routes at all", async () => {
      for (const path of ["/api/admin/users", "/api/admin/activity", "/api/logs"]) {
        const res = await call(path, "member");
        expect([401, 403]).toContain(res.status);
      }
    });
  });

  describe("applyFieldPolicy (the mechanism)", () => {
    const data = { id: "u1", email: "a@x.test", whatsappNumber: "1", lastLoginAt: new Date(0), nested: [{ id: "u2", email: "b@x.test", name: "B" }] };

    it("owner sees own contact fields but not other people's, nested or in lists", () => {
      const out = applyFieldPolicy(data, { userId: "u1", roles: ["member"] });
      expect(out.email).toBe("a@x.test");
      expect(out.whatsappNumber).toBe("1");
      expect(out).not.toHaveProperty("lastLoginAt");
      expect(out.nested[0]).toEqual({ id: "u2", name: "B" });
    });

    it("admin and super_admin see everything in the table; anonymous sees none", () => {
      for (const role of ["admin", "super_admin"]) {
        expect(applyFieldPolicy(data, { userId: "z", roles: [role] }).nested[0].email).toBe("b@x.test");
      }
      expect(applyFieldPolicy([data], { roles: [] })[0]).toEqual({ id: "u1", nested: [{ id: "u2", name: "B" }] });
    });

    it("does not mutate its input and leaves Dates alone", () => {
      const before = JSON.stringify(data);
      const out = applyFieldPolicy(data, { userId: "z", roles: ["admin"] });
      expect(JSON.stringify(data)).toBe(before);
      expect(out.lastLoginAt).toBeInstanceOf(Date);
    });

    it("a new rule is one table entry: deny wins, and a relationship can unlock a field (DEC-015 shape)", () => {
      const dob: FieldPolicyEntry = { field: "dateOfBirth", sensitivity: "personal", roles: ["admin"], relationships: ["self", "recruiter-forwarded"], deny: ["company"] };
      const policy = [...FIELD_POLICY, dob];
      const row = { id: "c1", dateOfBirth: "2000-01-01" };
      const opts = { policy };
      expect(applyFieldPolicy(row, { userId: "c1", roles: ["member"] }, opts).dateOfBirth).toBe("2000-01-01");
      expect(applyFieldPolicy(row, { userId: "r", roles: ["recruiter"], relationships: ["recruiter-forwarded"] }, opts).dateOfBirth).toBe("2000-01-01");
      expect(applyFieldPolicy(row, { userId: "r", roles: ["recruiter"] }, opts)).not.toHaveProperty("dateOfBirth");
      expect(applyFieldPolicy(row, { userId: "k", roles: ["company", "admin"] }, opts)).not.toHaveProperty("dateOfBirth");
    });
  });
});
