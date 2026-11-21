import { INestApplication, RequestMethod } from "@nestjs/common";
import { DiscoveryService, MetadataScanner, Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { TokenService } from "../src/modules/identity/application/services/token.service";
import { toPublicUser, userWithRolesInclude } from "../src/modules/identity";
import { FeatureFlagsService, FLAG_HASH } from "../src/modules/feature-flags/feature-flags.service";
import { REDIS_CLIENT } from "../src/common/redis/redis.constants";

// TASK-015: every privileged route must leave an audit row. The routes are discovered from
// the live Nest metadata (same approach as permission-matrix.e2e-spec.ts), so a new
// permission-gated write that is neither audited here nor explicitly exempted fails the
// suite. Each audited route is then actually called as a super admin against fresh
// fixtures and must add exactly one row with the right action and actor.
//
// The log is append-only and cannot be cleaned, so every row is found by actor + action +
// target and only the fixtures are deleted.

const key = (r: { method: string; path: string }) => `${r.method} ${r.path}`;

// Permission-gated writes that are ordinary member content, not staff powers. Reviewed on purpose.
const EXEMPT: Record<string, string> = {
  "POST /api/blogs": "a member writing their own post",
  "POST /api/resources": "a member adding their own resource",
  "POST /api/recordings": "an instructor adding their own recording",
  "POST /api/forums/threads": "a member opening their own thread",
  "POST /api/forums/threads/:id/replies": "a member replying",
  "POST /api/quizzes/:id/attempts": "a learner starting their own attempt",
};

// Owner-or-staff routes: a staff caller deleting someone else's content must be recorded.
const STAFF_DELETE_ROUTES = [
  "DELETE /api/blogs/:id",
  "DELETE /api/blogs/:id/comments/:commentId",
  "DELETE /api/resources/:id",
  "DELETE /api/recordings/:id",
  "DELETE /api/forums/threads/:id",
  "DELETE /api/forums/threads/:id/replies/:replyId",
];

// Public routes that write audit rows; covered by their own test files.
const PUBLIC_AUDITED: Record<string, string> = {
  "POST /api/auth/register-admin": "admin-signup-audit.e2e-spec.ts",
};

type Route = { method: string; path: string; permission?: string; isPublic: boolean };

function discoverRoutes(app: INestApplication): Route[] {
  const discovery = app.get(DiscoveryService);
  const scanner = app.get(MetadataScanner);
  const reflector = app.get(Reflector);
  const routes: Route[] = [];
  for (const wrapper of discovery.getControllers()) {
    if (!wrapper.instance || !wrapper.metatype) continue;
    const proto = Object.getPrototypeOf(wrapper.instance);
    const controllerPath = Reflect.getMetadata("path", wrapper.metatype);
    for (const name of scanner.getAllMethodNames(proto)) {
      const handler = proto[name];
      const methodPath = Reflect.getMetadata("path", handler);
      if (methodPath === undefined) continue;
      const read = <T>(k: string) => reflector.getAllAndOverride<T>(k, [handler, wrapper.metatype!]);
      routes.push({
        method: RequestMethod[Reflect.getMetadata("method", handler)],
        path: ("/api/" + controllerPath + "/" + methodPath).replace(/\/+/g, "/").replace(/(.)\/$/, "$1"),
        permission: read<string>("requirePermission"),
        isPublic: !!read<boolean>("isPublic"),
      });
    }
  }
  return routes;
}

jest.setTimeout(120_000);

describe("Audit coverage of privileged routes (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let routes: Route[];
  let adminId: string;
  let ownerId: string;
  let categoryId: string;
  let cookie: string;
  let originalSettings: Record<string, unknown>;
  const TAG = `auditcov-${Date.now()}`;
  const PREFIX = "auditcov-";
  let n = 0;
  const uniq = () => `${TAG}-${++n}`;

  const api = (method: "put" | "post" | "delete", url: string, body?: object) => {
    const r = request(app.getHttpServer())[method](url).set("Cookie", cookie);
    return body ? r.send(body) : r;
  };

  async function makeUser(name: string, extra: { isApproved?: boolean } = {}) {
    return prisma.user.create({
      data: {
        firstName: "Cov",
        lastName: name,
        email: `${PREFIX}${name}-${uniq()}@example.com`,
        isApproved: extra.isApproved ?? true,
        emailVerified: true,
        roles: { create: [{ role: { connect: { name: name === "admin" ? "super_admin" : "member" } } }] },
      },
      include: userWithRolesInclude,
    });
  }

  const makeBlog = () =>
    prisma.blogPost.create({ data: { title: uniq(), slug: uniq(), content: "body", authorId: ownerId, categoryId, isPublished: true } });
  const makeResource = () =>
    prisma.resource.create({ data: { title: uniq(), description: "d", resourceType: "article", categoryId, userId: ownerId } });
  const makeRecording = () =>
    prisma.recording.create({ data: { title: uniq(), description: "d", recordingUrl: "https://example.com/r", categoryId, instructorId: ownerId } });
  const makeThread = () =>
    prisma.forumThread.create({ data: { categoryId, authorId: ownerId, title: uniq(), content: "c", slug: uniq() } });

  const makeSkill = (status: "active" | "retired" = "active") => {
    const name = uniq();
    return prisma.skill.create({ data: { name, nameKey: name.toLowerCase(), matchKey: name.replace(/\W/g, "").toLowerCase(), level: "major", status } });
  };
  const makeSuggestion = () => {
    const name = uniq();
    return prisma.skillSuggestion.create({ data: { name, nameKey: name.toLowerCase(), matchKey: name.replace(/\W/g, "").toLowerCase(), suggestedById: ownerId } });
  };

  // action, target, and how to trigger the route as the admin
  type Scenario = () => Promise<{ action: string; targetId?: string }>;
  const scenarios: Record<string, Scenario> = {
    "PUT /api/admin/settings": async () => {
      const { id, updatedAt, createdAt, ...body } = originalSettings as Record<string, unknown>;
      void id; void updatedAt; void createdAt;
      await api("put", "/api/admin/settings", { ...body, siteName: `Cov ${TAG}`, reason: `${TAG} settings change reason` }).expect(200);
      return { action: "site_settings_changed", targetId: "default" };
    },
    "PUT /api/admin/feature-flags/:key": async () => {
      // One real change; afterAll deletes the override so no later suite sees it disabled.
      await api("put", "/api/admin/feature-flags/blogs.comments", { enabled: false, reason: `${TAG} feature switch reason` }).expect(200);
      return { action: "site_settings_changed", targetId: "blogs.comments" };
    },
    "PUT /api/admin/users/:id/approve": async () => {
      const u = await makeUser("pending", { isApproved: false });
      await api("put", `/api/admin/users/${u.id}/approve`, {}).expect(200);
      return { action: "user_approved", targetId: u.id };
    },
    "PUT /api/admin/users/:id/unapprove": async () => {
      const u = await makeUser("approved");
      await api("put", `/api/admin/users/${u.id}/unapprove`, {}).expect(200);
      return { action: "user_unapproved", targetId: u.id };
    },
    "PUT /api/admin/users/:id/roles": async () => {
      const u = await makeUser("roles");
      await api("put", `/api/admin/users/${u.id}/roles`, { roleNames: ["moderator"] }).expect(200);
      return { action: "user_roles_changed", targetId: u.id };
    },
    "DELETE /api/admin/users/:id": async () => {
      const u = await makeUser("doomed");
      await api("delete", `/api/admin/users/${u.id}`, { reason: `${TAG} delete this user` }).expect(200);
      return { action: "user_deleted", targetId: u.id };
    },
    "PUT /api/admin/users/:id/clean-data": async () => {
      const u = await makeUser("clean");
      await api("put", `/api/admin/users/${u.id}/clean-data`, { dataType: "all", reason: `${TAG} clean this user` }).expect(200);
      return { action: "user_data_cleaned", targetId: u.id };
    },
    "PUT /api/admin/users/bulk-clean-data": async () => {
      const u = await makeUser("bulk");
      await api("put", "/api/admin/users/bulk-clean-data", { userIds: [u.id], dataType: "all", reason: `${TAG} bulk clean` }).expect(200);
      return { action: "users_data_bulk_cleaned" };
    },
    "PUT /api/admin/resources/:id/approve": async () => {
      const r = await makeResource();
      await api("put", `/api/admin/resources/${r.id}/approve`, {}).expect(200);
      return { action: "resource_approved", targetId: r.id };
    },
    "PUT /api/admin/resources/:id/unapprove": async () => {
      const r = await makeResource();
      await api("put", `/api/admin/resources/${r.id}/unapprove`, {}).expect(200);
      return { action: "resource_unapproved", targetId: r.id };
    },
    "PUT /api/admin/recordings/:id/approve": async () => {
      const r = await makeRecording();
      await api("put", `/api/admin/recordings/${r.id}/approve`, {}).expect(200);
      return { action: "recording_approved", targetId: r.id };
    },
    "PUT /api/admin/recordings/:id/unapprove": async () => {
      const r = await makeRecording();
      await api("put", `/api/admin/recordings/${r.id}/unapprove`, {}).expect(200);
      return { action: "recording_unapproved", targetId: r.id };
    },
    "PUT /api/admin/blogs/:id/approve": async () => {
      const b = await makeBlog();
      await api("put", `/api/admin/blogs/${b.id}/approve`, {}).expect(200);
      return { action: "blog_approved", targetId: b.id };
    },
    "PUT /api/admin/blogs/:id/unapprove": async () => {
      const b = await makeBlog();
      await api("put", `/api/admin/blogs/${b.id}/unapprove`, {}).expect(200);
      return { action: "blog_unapproved", targetId: b.id };
    },
    "POST /api/categories": async () => {
      const res = await api("post", "/api/categories", { name: uniq(), slug: uniq().toLowerCase() }).expect(201);
      return { action: "category_created", targetId: res.body.id };
    },
    "PUT /api/categories/reorder": async () => {
      const all = await prisma.category.findMany({ orderBy: { position: "asc" }, select: { id: true } });
      await api("put", "/api/categories/reorder", { orderedIds: all.map((c) => c.id) }).expect(200);
      return { action: "categories_reordered" };
    },
    "PUT /api/categories/:id": async () => {
      const c = await prisma.category.create({ data: { name: uniq(), slug: uniq().toLowerCase() } });
      await api("put", `/api/categories/${c.id}`, { name: `${c.name}-renamed` }).expect(200);
      return { action: "category_updated", targetId: c.id };
    },
    "DELETE /api/categories/:id": async () => {
      const c = await prisma.category.create({ data: { name: uniq(), slug: uniq().toLowerCase() } });
      await api("delete", `/api/categories/${c.id}`).expect(200);
      return { action: "category_deleted", targetId: c.id };
    },
    "PUT /api/forums/threads/:id/lock": async () => {
      const t = await makeThread();
      await api("put", `/api/forums/threads/${t.id}/lock`, {}).expect(200);
      return { action: "forum_thread_locked", targetId: t.id };
    },
    "PUT /api/forums/threads/:id/unlock": async () => {
      const t = await makeThread();
      await api("put", `/api/forums/threads/${t.id}/unlock`, {}).expect(200);
      return { action: "forum_thread_unlocked", targetId: t.id };
    },
    "PUT /api/forums/threads/:id/pin": async () => {
      const t = await makeThread();
      await api("put", `/api/forums/threads/${t.id}/pin`, {}).expect(200);
      return { action: "forum_thread_pinned", targetId: t.id };
    },
    "PUT /api/forums/threads/:id/unpin": async () => {
      const t = await makeThread();
      await api("put", `/api/forums/threads/${t.id}/unpin`, {}).expect(200);
      return { action: "forum_thread_unpinned", targetId: t.id };
    },
    "POST /api/quizzes": async () => {
      const res = await api("post", "/api/quizzes", {
        title: uniq(),
        description: "d",
        categoryId,
        questions: [{ questionText: "q?", questionType: "single_choice", options: [{ optionText: "a", isCorrect: true }, { optionText: "b" }] }],
      }).expect(201);
      return { action: "quiz_created", targetId: res.body.id };
    },
    "PUT /api/quizzes/:id": async () => {
      const q = await prisma.quiz.create({ data: { title: uniq(), description: "d", categoryId, createdById: adminId } });
      await api("put", `/api/quizzes/${q.id}`, { title: `${q.title}-edited` }).expect(200);
      return { action: "quiz_updated", targetId: q.id };
    },
    "DELETE /api/quizzes/:id": async () => {
      const q = await prisma.quiz.create({ data: { title: uniq(), description: "d", categoryId, createdById: adminId } });
      await api("delete", `/api/quizzes/${q.id}`).expect(200);
      return { action: "quiz_deleted", targetId: q.id };
    },
    "DELETE /api/blogs/:id": async () => {
      const b = await makeBlog();
      await api("delete", `/api/blogs/${b.id}`).expect(200);
      return { action: "blog_deleted", targetId: b.id };
    },
    "DELETE /api/blogs/:id/comments/:commentId": async () => {
      const b = await makeBlog();
      const c = await prisma.blogComment.create({ data: { blogPostId: b.id, userId: ownerId, content: "c" } });
      await api("delete", `/api/blogs/${b.id}/comments/${c.id}`).expect(200);
      return { action: "blog_comment_deleted", targetId: c.id };
    },
    "DELETE /api/resources/:id": async () => {
      const r = await makeResource();
      await api("delete", `/api/resources/${r.id}`).expect(200);
      return { action: "resource_deleted", targetId: r.id };
    },
    "DELETE /api/recordings/:id": async () => {
      const r = await makeRecording();
      await api("delete", `/api/recordings/${r.id}`).expect(200);
      return { action: "recording_deleted", targetId: r.id };
    },
    "DELETE /api/forums/threads/:id": async () => {
      const t = await makeThread();
      await api("delete", `/api/forums/threads/${t.id}`).expect(200);
      return { action: "forum_thread_deleted", targetId: t.id };
    },
    "DELETE /api/forums/threads/:id/replies/:replyId": async () => {
      const t = await makeThread();
      const r = await prisma.forumReply.create({ data: { threadId: t.id, authorId: ownerId, content: "c" } });
      await api("delete", `/api/forums/threads/${t.id}/replies/${r.id}`).expect(200);
      return { action: "forum_reply_deleted", targetId: r.id };
    },
    "POST /api/skills": async () => {
      const res = await api("post", "/api/skills", { name: uniq(), level: "major" }).expect(201);
      return { action: "skill_created", targetId: res.body.id };
    },
    "PUT /api/skills/:id": async () => {
      const k = await makeSkill();
      await api("put", `/api/skills/${k.id}`, { description: "edited" }).expect(200);
      return { action: "skill_updated", targetId: k.id };
    },
    "PUT /api/skills/:id/retire": async () => {
      const k = await makeSkill();
      await api("put", `/api/skills/${k.id}/retire`, { reason: `${TAG} retire this skill` }).expect(200);
      return { action: "skill_retired", targetId: k.id };
    },
    "PUT /api/skills/:id/restore": async () => {
      const k = await makeSkill("retired");
      await api("put", `/api/skills/${k.id}/restore`, {}).expect(200);
      return { action: "skill_restored", targetId: k.id };
    },
    "POST /api/skills/:id/aliases": async () => {
      const k = await makeSkill();
      await api("post", `/api/skills/${k.id}/aliases`, { alias: uniq() }).expect(201);
      return { action: "skill_alias_added", targetId: k.id };
    },
    "DELETE /api/skills/:id/aliases/:aliasId": async () => {
      const k = await makeSkill();
      const a = await prisma.skillAlias.create({ data: { skillId: k.id, alias: uniq(), aliasKey: uniq().toLowerCase(), matchKey: uniq().replace(/\W/g, "").toLowerCase() } });
      await api("delete", `/api/skills/${k.id}/aliases/${a.id}`).expect(200);
      return { action: "skill_alias_removed", targetId: k.id };
    },
    "PUT /api/skills/suggestions/:id/add": async () => {
      const s = await makeSuggestion();
      await api("put", `/api/skills/suggestions/${s.id}/add`, { level: "major" }).expect(200);
      return { action: "skill_suggestion_added", targetId: s.id };
    },
    "PUT /api/skills/suggestions/:id/merge": async () => {
      const k = await makeSkill();
      const s = await makeSuggestion();
      await api("put", `/api/skills/suggestions/${s.id}/merge`, { skillId: k.id }).expect(200);
      return { action: "skill_suggestion_merged", targetId: s.id };
    },
    "POST /api/admin/consent/policies": async () => {
      const res = await api("post", "/api/admin/consent/policies", {
        purpose: "resume_sharing",
        title: `${TAG} policy`,
        summary: `${TAG} plain language summary of the change`,
        reason: `${TAG} wording clarified`,
      }).expect(201);
      const row = await prisma.consentPolicy.findFirstOrThrow({ where: { purpose: "resume_sharing", version: res.body.version } });
      return { action: "consent_policy_published", targetId: row.id };
    },
    "PUT /api/skills/suggestions/:id/reject": async () => {
      const s = await makeSuggestion();
      await api("put", `/api/skills/suggestions/${s.id}/reject`, { reason: `${TAG} reject this one` }).expect(200);
      return { action: "skill_suggestion_rejected", targetId: s.id };
    },
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix("api");
    await app.init();
    prisma = app.get(PrismaService);
    routes = discoverRoutes(app);
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
    const admin = await makeUser("admin");
    adminId = admin.id;
    ownerId = (await makeUser("owner")).id;
    cookie = `accessToken=${app.get(TokenService).signAccessToken(toPublicUser(admin))}`;
    categoryId = (await prisma.category.create({ data: { name: TAG, slug: TAG.toLowerCase() } })).id;
    originalSettings = (await request(app.getHttpServer()).get("/api/admin/settings").set("Cookie", cookie).expect(200)).body;
  });

  afterAll(async () => {
    await app.get<{ del: (k: string) => Promise<unknown> }>(REDIS_CLIENT).del(FLAG_HASH);
    app.get(FeatureFlagsService).invalidate();
    if (originalSettings) {
      const { id, updatedAt, createdAt, ...rest } = originalSettings as Record<string, unknown>;
      void id; void updatedAt; void createdAt;
      await prisma.siteSettings.update({ where: { id: "default" }, data: rest as never });
    }
    await prisma.quiz.deleteMany({ where: { categoryId } });
    await prisma.blogPost.deleteMany({ where: { categoryId } });
    await prisma.resource.deleteMany({ where: { categoryId } });
    await prisma.recording.deleteMany({ where: { categoryId } });
    await prisma.forumThread.deleteMany({ where: { categoryId } });
    await prisma.consentPolicy.deleteMany({ where: { createdById: adminId } });
    await prisma.skillSuggestion.deleteMany({ where: { nameKey: { startsWith: TAG.toLowerCase() } } });
    await prisma.skill.deleteMany({ where: { nameKey: { startsWith: TAG.toLowerCase() } } });
    await prisma.category.deleteMany({ where: { OR: [{ id: categoryId }, { slug: { startsWith: TAG.toLowerCase() } }] } });
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await app.close();
  });

  it("every permission-gated write is either audited here or on the reviewed exempt list", () => {
    const gatedWrites = routes.filter((r) => !r.isPublic && r.permission && r.method !== "GET").map(key);
    const known = new Set([...Object.keys(scenarios), ...Object.keys(EXEMPT)]);
    expect(gatedWrites.filter((k) => !known.has(k))).toEqual([]);
    expect(gatedWrites.filter((k) => k in scenarios && k in EXEMPT)).toEqual([]);
  });

  it("the lists name only routes that exist", () => {
    const existing = new Set(routes.map(key));
    const named = [...Object.keys(scenarios), ...Object.keys(EXEMPT), ...STAFF_DELETE_ROUTES, ...Object.keys(PUBLIC_AUDITED)];
    expect(named.filter((k) => !existing.has(k))).toEqual([]);
    expect(STAFF_DELETE_ROUTES.filter((k) => !(k in scenarios))).toEqual([]);
  });

  it("every audited route writes exactly one audit row for the actor, action and target", async () => {
    const failures: string[] = [];
    for (const [route, run] of Object.entries(scenarios)) {
      const since = new Date(Date.now() - 1000);
      let outcome: { action: string; targetId?: string };
      try {
        outcome = await run();
      } catch (e) {
        failures.push(`${route}: scenario failed: ${(e as Error).message}`);
        continue;
      }
      const rows = await prisma.adminActivityLog.findMany({
        where: { action: outcome.action as never, actorId: adminId, createdAt: { gte: since }, ...(outcome.targetId ? { targetId: outcome.targetId } : {}) },
      });
      if (rows.length !== 1) failures.push(`${route}: expected 1 '${outcome.action}' row, found ${rows.length}`);
      for (const row of rows) {
        if (/password|secret|token|apikey/i.test(JSON.stringify(row.details ?? {}))) failures.push(`${route}: details look secret-bearing`);
      }
    }
    expect(failures).toEqual([]);
  });

  it("an owner deleting their own content writes no staff entry", async () => {
    const owner = await prisma.user.findFirstOrThrow({ where: { id: ownerId }, include: userWithRolesInclude });
    const ownerCookie = `accessToken=${app.get(TokenService).signAccessToken(toPublicUser(owner))}`;
    const blog = await makeBlog();
    const since = new Date(Date.now() - 1000);
    await request(app.getHttpServer()).delete(`/api/blogs/${blog.id}`).set("Cookie", ownerCookie).expect(200);
    expect(await prisma.adminActivityLog.count({ where: { action: "blog_deleted", targetId: blog.id, createdAt: { gte: since } } })).toBe(0);
  });
});
