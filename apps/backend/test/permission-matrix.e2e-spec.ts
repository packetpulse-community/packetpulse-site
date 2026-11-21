import { INestApplication, RequestMethod } from "@nestjs/common";
import { DiscoveryService, MetadataScanner, Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import { randomUUID } from "crypto";
import { writeFileSync } from "fs";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { TokenService } from "../src/modules/identity/application/services/token.service";
import { toPublicUser, userWithRolesInclude } from "../src/modules/identity";

// TASK-008 / TEST-005 / TEST-006. The route list is discovered from the live Nest router
// metadata (DiscoveryService + Reflector), never written by hand, so a route added later
// with no declared access rule fails here. Sessions are real users created through
// Prisma, authenticated by signing an access token directly (no /login, so the per-route
// login throttle never gets involved).
//
// Every probe sends an empty body and a random id: validation or a 404 stops the request
// before anything is written, so an "allowed" role is recognised by "not 401/403".
//
// Set ROUTE_INVENTORY_OUT=<file> to write the inventory table used by
// docs/research/11-route-inventory.md.

type Route = {
  method: string;
  path: string; // full path, including the /api prefix
  handler: string;
  isPublic: boolean;
  permission?: string;
  skipApproval: boolean;
  skipEmailVerification: boolean;
  allowDuringMaintenance: boolean;
};

const key = (r: { method: string; path: string }) => `${r.method} ${r.path}`;

// The role matrix as the owner's plan defines it (apps/backend/prisma/seed.ts). Asserted
// against the seeded database below so a silent change to role_permissions fails a test.
const MEMBER = ["blogs:create", "resources:create", "recordings:create", "forums:create", "quizzes:attempt"];
const ROLE_MATRIX: Record<string, string[]> = {
  member: MEMBER,
  moderator: ["blogs:moderate", "resources:moderate", "recordings:moderate", "forums:moderate"],
  instructor: ["recordings:create", "quizzes:author"],
  admin: [
    ...MEMBER,
    "blogs:publish",
    "blogs:moderate",
    "resources:moderate",
    "recordings:moderate",
    "forums:moderate",
    "quizzes:author",
    "users:approve",
    "users:manage-roles",
    "admin:clean-data",
    "admin:view-analytics",
    "admin:manage-settings",
    "categories:manage",
    "skills:manage",
  ],
  super_admin: [], // bypasses permission checks in RolesGuard
};
const ROLES = Object.keys(ROLE_MATRIX);

// Permissions that no role holds on purpose: only the super_admin bypass passes (DEC-015, PRD-044).
const SUPER_ADMIN_ONLY = ["policies:manage"];

// Routes that anyone may call without signing in. A new @Public route must be added here
// on purpose.
const PUBLIC_ROUTES = new Set([
  "GET /api/site-status",
  "GET /api/feature-flags",
  "GET /api/health",
  "POST /api/auth/register",
  "POST /api/auth/register-admin",
  "POST /api/auth/login",
  "POST /api/auth/refresh",
  "POST /api/auth/forgotpassword",
  "POST /api/auth/verifyotp",
  "POST /api/auth/resetpassword",
  "POST /api/auth/verify-email",
  "POST /api/auth/verify-email-code",
  "POST /api/auth/resend-email-code",
  "GET /api/blogs",
  "GET /api/blogs/featured",
  "GET /api/blogs/slug/:slug",
  "GET /api/blogs/:id",
  "GET /api/categories",
  "GET /api/skills",
  "GET /api/consent/policies",
  "GET /api/recordings",
  "GET /api/recordings/:id",
  "GET /api/forums/categories",
  "GET /api/forums/threads",
  "GET /api/forums/threads/:id",
  "GET /api/forums/guidelines",
  "GET /api/quizzes",
  "GET /api/quizzes/certificates/verify/:certificateNumber",
  "GET /api/quizzes/:id",
  "POST /api/logs",
]);

// Signed-in routes with no @RequirePermission: any approved, email-verified account may
// call them. The value is the ownership/state rule the service enforces (or "own data").
const AUTHENTICATED_ONLY: Record<string, string> = {
  "GET /api/notifications": "own notifications only",
  "GET /api/notifications/unread-count": "own notifications only",
  "PUT /api/notifications/:id/read": "own notification only",
  "PUT /api/notifications/read-all": "own notifications only",
  "GET /api/notifications/preferences": "own preferences only (the number is masked)",
  "PUT /api/notifications/preferences": "own preferences only; critical events cannot be switched off",
  "POST /api/notifications/whatsapp/confirm-number": "own number only; records a request, sends nothing",
  "POST /api/auth/logout": "own session",
  "GET /api/auth/me": "own profile",
  "POST /api/auth/resend-verification": "own account; email-verification exempt",
  "GET /api/onboarding": "own onboarding status only (the member's own date of birth is included; nobody else's is reachable)",
  "PUT /api/onboarding": "own details only; date of birth must make the member 18 or older; blank WhatsApp clears it",
  "POST /api/onboarding/complete": "own account; refused with the list of missing items until the required details are in",
  "GET /api/consent/mine": "own consent state and history; open to unapproved and unverified accounts so a changed policy can be re-accepted",
  "PUT /api/consent/mine": "own consents only; Terms and Privacy cannot be withdrawn; must name the current policy version",
  "GET /api/members/:userId": "any approved member; private profile fields are stripped by the field-protection policy unless the owner opened them to members (staff and the owner always see them)",
  "GET /api/users/profile": "own profile",
  "GET /api/users/profile/privacy": "own profile visibility settings; open to pending and unverified accounts",
  "PUT /api/users/profile/privacy": "own profile visibility settings; private or members only, no public level",
  "PUT /api/users/profile": "own profile",
  "PUT /api/users/profile/password": "own account; needs current password",
  "DELETE /api/users/profile": "own account; needs password; since TASK-046 it schedules the deletion (30-day grace) instead of deleting at once",
  "GET /api/data-rights": "own export and erasure requests only; open to pending, unverified and deactivated accounts",
  "POST /api/data-rights/export": "own data only; one open export per member; switch data_rights.export; open to pending, unverified and deactivated accounts",
  "POST /api/data-rights/export/link": "own prepared export only (others get 404); a 5-minute signed link, logged in the file access log and the audit log",
  "DELETE /api/data-rights/export": "own open export only; removes the file",
  "POST /api/data-rights/erasure": "own account; password re-entry; schedules the erasure after the 30-day grace period and deactivates the account",
  "DELETE /api/data-rights/erasure": "own pending deletion only; reactivates the account (refused once the erasure job has started)",
  "PUT /api/blogs/:id": "post author or admin",
  "DELETE /api/blogs/:id": "post author or admin",
  "POST /api/blogs/:id/comments": "any member",
  "DELETE /api/blogs/:id/comments/:commentId": "comment author or admin",
  "PUT /api/blogs/:id/like": "any member",
  "GET /api/resources": "approved resources; admin also sees pending",
  "GET /api/resources/:id": "approved resource; admin also sees pending",
  "PUT /api/resources/:id": "resource owner or admin",
  "DELETE /api/resources/:id": "resource owner or admin",
  "PUT /api/resources/:id/like": "any member",
  "PUT /api/resources/:id/download": "any member",
  "PUT /api/recordings/:id": "recording owner or admin",
  "DELETE /api/recordings/:id": "recording owner or admin",
  "PUT /api/recordings/:id/like": "any member",
  "POST /api/recordings/:id/join": "any member",
  "PUT /api/forums/threads/:id": "thread author or moderator",
  "PUT /api/forums/threads/:id/accept/:replyId": "the asker, or a moderator who gives a reason (audited); the reply must belong to the thread and not be removed",
  "DELETE /api/forums/threads/:id/accept": "the asker, or a moderator who gives a reason (audited)",
  "POST /api/forums/threads/:id/report": "any member except the author; a reason is required; one report per member per post, 10 a day",
  "POST /api/forums/replies/:replyId/report": "any member except the author; a reason is required; one report per member per post, 10 a day",
  "GET /api/forums/guidelines/status": "own acceptance state of the community guidelines",
  "POST /api/forums/guidelines/accept": "own acceptance only; records the current version and the time",
  "GET /api/forums/reputation/:userId": "any member; a total, a level and an accepted-answer count, no private fields",
  "DELETE /api/forums/threads/:id": "thread author or moderator",
  "DELETE /api/forums/threads/:id/replies/:replyId": "reply author or moderator",
  "PUT /api/forums/replies/:replyId/like": "any member",
  "GET /api/quizzes/certificates/mine": "own certificates",
  "GET /api/quizzes/:id/attempts/mine": "own attempts",
  "POST /api/quizzes/:id/attempts/:attemptId/submit": "own attempt",
  "POST /api/network-tools/run": "any member; simulated output only",
  "GET /api/dashboard/stats": "own stats",
  "GET /api/skills/mine": "own skills only",
  "PUT /api/skills/mine": "own skills only; max 25, active taxonomy skills only",
  "GET /api/skills/members/:userId": "any member; filtered by the owner's per-skill visibility (private only for the owner)",
  "POST /api/skills/suggestions": "any member; counts one sighting per member, 5 new names a day",
  "POST /api/files/upload-url": "any member; creates a pending file owned by the caller",
  "POST /api/files/:id/complete": "file owner only (others get 404)",
  "GET /api/files/:id/link": "file owner or admin (others get 404, logged as denied)",
  "DELETE /api/files/:id": "file owner or admin (others get 404, logged as denied)",
};

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
      expect(typeof controllerPath === "string" && typeof methodPath === "string").toBe(true);
      const read = <T>(metaKey: string) => reflector.getAllAndOverride<T>(metaKey, [handler, wrapper.metatype!]);
      const path = ("/api/" + controllerPath + "/" + methodPath).replace(/\/+/g, "/").replace(/(.)\/$/, "$1");
      routes.push({
        method: RequestMethod[Reflect.getMetadata("method", handler)],
        path,
        handler: `${wrapper.metatype.name}.${name}`,
        isPublic: !!read<boolean>("isPublic"),
        permission: read<string>("requirePermission"),
        skipApproval: !!read<boolean>("skipApproval"),
        skipEmailVerification: !!read<boolean>("skipEmailVerification"),
        allowDuringMaintenance: !!read<boolean>("allowDuringMaintenance"),
      });
    }
  }
  return routes.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
}

jest.setTimeout(120_000);

describe("Permission matrix (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokens: TokenService;
  let routes: Route[];

  const PREFIX = "pm-";
  const emailFor = (name: string) => `${PREFIX}${name}@example.com`;
  const tokenByActor: Record<string, string> = {};

  async function createActor(name: string, roleName: string, flags: { isApproved: boolean; emailVerified: boolean }) {
    const user = await prisma.user.create({
      data: {
        firstName: "Matrix",
        lastName: name,
        email: emailFor(name),
        isApproved: flags.isApproved,
        emailVerified: flags.emailVerified,
        roles: { create: [{ role: { connect: { name: roleName } } }] },
      },
      include: userWithRolesInclude,
    });
    tokenByActor[name] = tokens.signAccessToken(toPublicUser(user));
  }

  function probe(route: Route, actor?: string) {
    const url = route.path
      .replace(/:certificateNumber/g, "no-such-certificate")
      .replace(/:slug/g, "no-such-slug")
      .replace(/:\w+/g, () => randomUUID());
    let req = request(app.getHttpServer())[route.method.toLowerCase() as "get" | "post" | "put" | "delete" | "patch"](url);
    if (actor) req = req.set("Cookie", `accessToken=${tokenByActor[actor]}`);
    return route.method === "GET" || route.method === "DELETE" ? req : req.send({});
  }

  async function cleanup() {
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix("api");
    await app.init();
    prisma = app.get(PrismaService);
    tokens = app.get(TokenService);
    routes = discoverRoutes(app);
    await cleanup();
    for (const role of ROLES) await createActor(role, role, { isApproved: true, emailVerified: true });
    await createActor("pending", "member", { isApproved: false, emailVerified: true });
    await createActor("unverified", "member", { isApproved: true, emailVerified: false });
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  it("writes the route inventory when ROUTE_INVENTORY_OUT is set", () => {
    if (!process.env.ROUTE_INVENTORY_OUT) return;
    writeFileSync(process.env.ROUTE_INVENTORY_OUT, JSON.stringify({ routes, ownership: AUTHENTICATED_ONLY }, null, 2));
  });

  describe("route declarations", () => {
    it("every route declares exactly one access rule", () => {
      const undeclared = routes
        .filter((r) => !r.isPublic && !r.permission && !(key(r) in AUTHENTICATED_ONLY))
        .map(key);
      expect(undeclared).toEqual([]);
      const contradictory = routes.filter((r) => [r.isPublic, !!r.permission, key(r) in AUTHENTICATED_ONLY].filter(Boolean).length > 1);
      expect(contradictory.map(key)).toEqual([]);
    });

    it("the set of @Public routes is exactly the reviewed list", () => {
      expect(routes.filter((r) => r.isPublic).map(key).sort()).toEqual([...PUBLIC_ROUTES].sort());
    });

    it("the authenticated-only list names only routes that exist", () => {
      const existing = new Set(routes.map(key));
      expect(Object.keys(AUTHENTICATED_ONLY).filter((k) => !existing.has(k))).toEqual([]);
    });

    it("every required permission is one a seeded role actually holds", async () => {
      const all = new Set([...Object.values(ROLE_MATRIX).flat(), ...SUPER_ADMIN_ONLY]);
      expect(routes.filter((r) => r.permission && !all.has(r.permission)).map(key)).toEqual([]);
    });
  });

  describe("seeded role matrix", () => {
    it.each(ROLES)("role %s holds exactly the permissions the plan gives it", async (role) => {
      const row = await prisma.role.findUniqueOrThrow({ where: { name: role }, include: { permissions: { include: { permission: true } } } });
      expect(row.permissions.map((p) => p.permission.key).sort()).toEqual([...ROLE_MATRIX[role]].sort());
    });
  });

  describe("TEST-005: unauthenticated callers", () => {
    it("every non-public route answers 401 without a session", async () => {
      const failures: string[] = [];
      for (const route of routes.filter((r) => !r.isPublic)) {
        const res = await probe(route);
        if (res.status !== 401) failures.push(`${key(route)} -> ${res.status}`);
      }
      expect(failures).toEqual([]);
    });

    it("a malformed or foreign-signed token is treated as no session", async () => {
      const route = routes.find((r) => key(r) === "GET /api/auth/me")!;
      const res = await request(app.getHttpServer()).get(route.path).set("Cookie", "accessToken=not-a-jwt");
      expect(res.status).toBe(401);
    });
  });

  describe("TEST-006: account state", () => {
    it("an unapproved account is refused on every route that needs approval", async () => {
      const failures: string[] = [];
      for (const route of routes.filter((r) => !r.isPublic && !r.skipApproval)) {
        const res = await probe(route, "pending");
        if (res.status !== 403) failures.push(`${key(route)} -> ${res.status}`);
      }
      expect(failures).toEqual([]);
    });

    it("an approved account with an unverified email is refused on every route that needs verification", async () => {
      const failures: string[] = [];
      for (const route of routes.filter((r) => !r.isPublic && !r.skipApproval && !r.skipEmailVerification)) {
        const res = await probe(route, "unverified");
        if (res.status !== 403) failures.push(`${key(route)} -> ${res.status}`);
      }
      expect(failures).toEqual([]);
    });

    it("an unverified account may still reach the routes that exempt verification", async () => {
      for (const route of routes.filter((r) => !r.isPublic && r.skipEmailVerification)) {
        const res = await probe(route, "unverified");
        expect([401, 403]).not.toContain(res.status);
      }
    });
  });

  describe("TEST-006: permission per role", () => {
    it("a role without the required permission gets 403, a role with it is not rejected", async () => {
      const failures: string[] = [];
      for (const route of routes.filter((r) => !r.isPublic && r.permission)) {
        for (const role of ROLES) {
          const allowed = role === "super_admin" || ROLE_MATRIX[role].includes(route.permission!);
          const res = await probe(route, role);
          const rejected = res.status === 401 || res.status === 403;
          if (allowed === rejected) {
            failures.push(`${key(route)} as ${role}: expected ${allowed ? "allowed" : "403"}, got ${res.status}`);
          } else if (!allowed && res.status !== 403) {
            failures.push(`${key(route)} as ${role}: expected 403, got ${res.status}`);
          }
        }
      }
      expect(failures).toEqual([]);
    });

    it("every approved role may call the authenticated-only routes", async () => {
      const failures: string[] = [];
      for (const route of routes.filter((r) => !r.isPublic && !r.permission)) {
        for (const role of ROLES) {
          const res = await probe(route, role);
          if (res.status === 401 || res.status === 403) failures.push(`${key(route)} as ${role}: got ${res.status}`);
        }
      }
      expect(failures).toEqual([]);
    });
  });
  // Public routes must not hand unreviewed content to anonymous callers (TASK-008).
  describe("public routes expose only reviewed content", () => {
    let blogId: string;
    let blogSlug: string;
    let recordingId: string;
    let quizId: string;

    beforeAll(async () => {
      const author = await prisma.user.findUniqueOrThrow({ where: { email: emailFor("member") } });
      const category = await prisma.category.findFirstOrThrow();
      const blog = await prisma.blogPost.create({
        data: {
          title: "PM unapproved blog",
          slug: `pm-unapproved-${randomUUID()}`,
          content: "not reviewed yet",
          categoryId: category.id,
          authorId: author.id,
          isPublished: true,
          isApproved: false,
        },
      });
      blogId = blog.id;
      blogSlug = blog.slug;
      const recording = await prisma.recording.create({
        data: {
          title: "PM unapproved recording",
          description: "x",
          recordingUrl: "https://example.com/r",
          categoryId: category.id,
          instructorId: author.id,
          isApproved: false,
        },
      });
      recordingId = recording.id;
      const quiz = await prisma.quiz.create({
        data: { title: "PM draft quiz", description: "x", categoryId: category.id, createdById: author.id, isPublished: false },
      });
      quizId = quiz.id;
    });

    afterAll(async () => {
      await prisma.blogPost.deleteMany({ where: { id: blogId } });
      await prisma.recording.deleteMany({ where: { id: recordingId } });
      await prisma.quiz.deleteMany({ where: { id: quizId } });
    });

    it("hides an unapproved blog post from anonymous callers, by id and by slug", async () => {
      await request(app.getHttpServer()).get(`/api/blogs/${blogId}`).expect(404);
      await request(app.getHttpServer()).get(`/api/blogs/slug/${blogSlug}`).expect(404);
    });

    it("shows an unapproved blog post to its author and to an admin", async () => {
      for (const actor of ["member", "admin"]) {
        await request(app.getHttpServer()).get(`/api/blogs/${blogId}`).set("Cookie", `accessToken=${tokenByActor[actor]}`).expect(200);
      }
    });

    it("hides an unapproved blog post from a signed-in member who is not the author", async () => {
      await request(app.getHttpServer()).get(`/api/blogs/${blogId}`).set("Cookie", `accessToken=${tokenByActor.instructor}`).expect(404);
    });

    it("hides an unapproved recording and a draft quiz from anonymous callers", async () => {
      await request(app.getHttpServer()).get(`/api/recordings/${recordingId}`).expect(404);
      await request(app.getHttpServer()).get(`/api/quizzes/${quizId}`).expect(404);
    });
  });
});
