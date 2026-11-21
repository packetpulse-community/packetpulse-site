import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { TokenService } from "../src/modules/identity/application/services/token.service";
import { toPublicUser, userWithRolesInclude } from "../src/modules/identity";
import { acceptedConsents } from "./helpers/consents";

// TASK-025 / TEST-014 / PRD-010 / PRD-045 / DEC-015: consent is recorded with a time and the
// policy version, withdrawal takes effect, a changed policy asks again, and other accounts never
// see profile fields the owner kept private.

jest.setTimeout(120_000);

const PREFIX = "cp-";
const PASSWORD = "Passw0rd!23";
const SECRET = {
  bio: "CP-secret-bio-9f31",
  experience: "senior" as const,
  linkedin: "https://linkedin.example/cp-secret-9f31",
  certName: "CP-secret-certification-9f31",
  phone: "+91 70001 99999",
};

describe("Consent and profile privacy (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokens: TokenService;
  const cookies: Record<string, string> = {};
  const ids: Record<string, string> = {};
  const publishedPolicyIds: string[] = [];

  const as = (actor: string) => ({ Cookie: `accessToken=${cookies[actor]}` });
  const policyVersion = async (purpose: "terms" | "privacy" | "resume_sharing" | "recruitment_sharing") =>
    (await prisma.consentPolicy.findFirstOrThrow({ where: { purpose }, orderBy: { version: "desc" } })).version;

  async function createUser(name: string, role: string, extra: Record<string, unknown> = {}) {
    const user = await prisma.user.create({
      data: {
        firstName: "Consent",
        lastName: name,
        email: `${PREFIX}${name}@example.com`,
        isApproved: true,
        emailVerified: true,
        roles: { create: [{ role: { connect: { name: role } } }] },
        ...extra,
      },
      include: userWithRolesInclude,
    });
    cookies[name] = tokens.signAccessToken(toPublicUser(user));
    ids[name] = user.id;
    return user;
  }

  async function cleanup() {
    // Records go with the users (cascade); only then can a published test policy version go.
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
    if (publishedPolicyIds.length) await prisma.consentPolicy.deleteMany({ where: { id: { in: publishedPolicyIds } } });
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix("api");
    await app.init();
    prisma = app.get(PrismaService);
    tokens = app.get(TokenService);
    await cleanup();
    await createUser("member", "member");
    await createUser("admin", "admin");
    await createUser("super", "super_admin");
    await createUser("viewer", "member");
    await createUser("owner", "member", {
      bio: SECRET.bio,
      professionalExperience: SECRET.experience,
      whatsappNumber: SECRET.phone,
      socialLinks: { create: { linkedin: SECRET.linkedin } },
      certifications: { create: [{ name: SECRET.certName }] },
    });
    await createUser("pending", "member", { isApproved: false });
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  describe("registration records consent", () => {
    const email = `${PREFIX}registered@example.com`;
    const body = (extra: Record<string, unknown> = {}) => ({ firstName: "Reg", lastName: "Istered", email, password: PASSWORD, ageConfirmed: true, ...extra });

    it("serves the current policies publicly", async () => {
      const res = await request(app.getHttpServer()).get("/api/consent/policies").expect(200);
      expect(res.body.map((p: { purpose: string }) => p.purpose).sort()).toEqual(["privacy", "recruitment_sharing", "resume_sharing", "terms"]);
      for (const p of res.body) expect(p).toMatchObject({ version: expect.any(Number), title: expect.any(String), summary: expect.any(String) });
    });

    it("refuses a registration with no consents, reporting the field", async () => {
      const res = await request(app.getHttpServer()).post("/api/auth/register").send(body()).expect(400);
      expect(res.body.fields.map((f: { path: string }) => f.path)).toContain("consents");
      expect(await prisma.user.count({ where: { email } })).toBe(0);
    });

    it("refuses a registration that leaves out the Privacy Policy", async () => {
      const terms = (await acceptedConsents(prisma)).filter((c) => c.purpose === "terms");
      const res = await request(app.getHttpServer()).post("/api/auth/register").send(body({ consents: terms })).expect(400);
      expect(res.body.fields.map((f: { path: string }) => f.path)).toContain("consents");
      expect(await prisma.user.count({ where: { email } })).toBe(0);
    });

    it("refuses a stale policy version with 409 and creates no account", async () => {
      const stale = (await acceptedConsents(prisma)).map((c) => ({ ...c, policyVersion: c.policyVersion + 5 }));
      await request(app.getHttpServer()).post("/api/auth/register").send(body({ consents: stale })).expect(409);
      expect(await prisma.user.count({ where: { email } })).toBe(0);
    });

    it("stores one record per accepted policy with version, source, time and a hashed IP", async () => {
      const before = Date.now() - 2000;
      const consents = [...(await acceptedConsents(prisma)), { purpose: "resume_sharing", policyVersion: await policyVersion("resume_sharing") }];
      await request(app.getHttpServer()).post("/api/auth/register").send(body({ consents })).expect(201);
      const user = await prisma.user.findUniqueOrThrow({ where: { email } });
      const rows = await prisma.consentRecord.findMany({ where: { userId: user.id }, orderBy: { purpose: "asc" } });
      expect(rows.map((r) => r.purpose).sort()).toEqual(["privacy", "resume_sharing", "terms"]);
      for (const r of rows) {
        expect(r).toMatchObject({ action: "granted", source: "registration" });
        expect(r.createdAt.getTime()).toBeGreaterThan(before);
        expect(r.ipHash).toMatch(/^[0-9a-f]{32}$/);
        expect(JSON.stringify(r)).not.toMatch(/127\.0\.0\.1|::1/);
      }
      expect(rows.find((r) => r.purpose === "terms")!.policyVersion).toBe(await policyVersion("terms"));
    });
  });

  describe("consent centre", () => {
    it("shows state per purpose and an empty needs-action flag after registration-style grants", async () => {
      const res0 = await request(app.getHttpServer()).get("/api/consent/mine").set(as("member")).expect(200);
      // A member with no records yet must accept the required policies.
      expect(res0.body.needsAction).toBe(true);
      expect(res0.body.items.find((i: { purpose: string }) => i.purpose === "terms")).toMatchObject({ status: "not_given", needsAction: true });

      const v = { terms: await policyVersion("terms"), privacy: await policyVersion("privacy") };
      const res = await request(app.getHttpServer())
        .put("/api/consent/mine")
        .set(as("member"))
        .send({
          source: "recapture",
          changes: [
            { purpose: "terms", action: "granted", policyVersion: v.terms },
            { purpose: "privacy", action: "granted", policyVersion: v.privacy },
          ],
        })
        .expect(200);
      expect(res.body.needsAction).toBe(false);
      expect(res.body.history.map((h: { source: string }) => h.source)).toEqual(["recapture", "recapture"]);
    });

    it("grants and withdraws an optional consent, keeping every step in the history", async () => {
      const v = await policyVersion("recruitment_sharing");
      await request(app.getHttpServer()).put("/api/consent/mine").set(as("member")).send({ changes: [{ purpose: "recruitment_sharing", action: "granted", policyVersion: v }] }).expect(200);
      let view = (await request(app.getHttpServer()).get("/api/consent/mine").set(as("member")).expect(200)).body;
      expect(view.items.find((i: { purpose: string }) => i.purpose === "recruitment_sharing")).toMatchObject({ status: "granted", acceptedVersion: v });

      // Same choice again: nothing new is recorded.
      const countBefore = await prisma.consentRecord.count({ where: { userId: ids.member } });
      await request(app.getHttpServer()).put("/api/consent/mine").set(as("member")).send({ changes: [{ purpose: "recruitment_sharing", action: "granted", policyVersion: v }] }).expect(200);
      expect(await prisma.consentRecord.count({ where: { userId: ids.member } })).toBe(countBefore);

      await request(app.getHttpServer()).put("/api/consent/mine").set(as("member")).send({ changes: [{ purpose: "recruitment_sharing", action: "withdrawn", policyVersion: v }] }).expect(200);
      view = (await request(app.getHttpServer()).get("/api/consent/mine").set(as("member")).expect(200)).body;
      expect(view.items.find((i: { purpose: string }) => i.purpose === "recruitment_sharing")).toMatchObject({ status: "withdrawn" });
      const mine = view.history.filter((h: { purpose: string }) => h.purpose === "recruitment_sharing").map((h: { action: string }) => h.action);
      expect(mine).toEqual(["withdrawn", "granted"]); // newest first
      expect(view.history[0].createdAt).toEqual(expect.any(String));
    });

    it("cannot withdraw the Terms or the Privacy Policy", async () => {
      const res = await request(app.getHttpServer())
        .put("/api/consent/mine")
        .set(as("member"))
        .send({ changes: [{ purpose: "terms", action: "withdrawn", policyVersion: await policyVersion("terms") }] })
        .expect(400);
      expect(res.body.message).toMatch(/delete your account/i);
    });

    it("refuses a change against a version that is not the current one", async () => {
      await request(app.getHttpServer())
        .put("/api/consent/mine")
        .set(as("member"))
        .send({ changes: [{ purpose: "resume_sharing", action: "granted", policyVersion: 99 }] })
        .expect(409);
    });

    it("validates the whole request before writing any of it", async () => {
      const before = await prisma.consentRecord.count({ where: { userId: ids.member } });
      await request(app.getHttpServer())
        .put("/api/consent/mine")
        .set(as("member"))
        .send({
          changes: [
            { purpose: "resume_sharing", action: "granted", policyVersion: await policyVersion("resume_sharing") },
            { purpose: "terms", action: "withdrawn", policyVersion: await policyVersion("terms") },
          ],
        })
        .expect(400);
      expect(await prisma.consentRecord.count({ where: { userId: ids.member } })).toBe(before);
    });

    it("is append-only at the database: a record cannot be changed", async () => {
      const row = await prisma.consentRecord.findFirstOrThrow({ where: { userId: ids.member } });
      await expect(prisma.$executeRaw`UPDATE consent_records SET action = 'withdrawn' WHERE id = ${row.id}`).rejects.toThrow(/append-only/);
    });

    it("never shows one member's consent to another", async () => {
      const res = await request(app.getHttpServer()).get("/api/consent/mine").set(as("viewer")).expect(200);
      expect(res.body.history).toEqual([]);
    });
  });

  describe("policy versions (super admin only, audited)", () => {
    const publish = (actor: string, extra: Record<string, unknown> = {}) =>
      request(app.getHttpServer())
        .post("/api/admin/consent/policies")
        .set(as(actor))
        .send({ purpose: "terms", title: "Terms of Service", summary: "Updated plain language summary of the terms.", reason: "cp test: wording changed", ...extra });

    it("is refused for a member and for an ordinary admin", async () => {
      await publish("member").expect(403);
      await publish("admin").expect(403);
      await request(app.getHttpServer()).get("/api/admin/consent/policies").set(as("admin")).expect(403);
    });

    it("needs a reason", async () => {
      const res = await publish("super", { reason: "short" }).expect(400);
      expect(res.body.fields.map((f: { path: string }) => f.path)).toContain("reason");
    });

    it("publishes the next version, audits it with the reason, and asks members to accept again", async () => {
      const before = await policyVersion("terms");
      const res = await publish("super").expect(201);
      expect(res.body.version).toBe(before + 1);
      const row = await prisma.consentPolicy.findFirstOrThrow({ where: { purpose: "terms", version: before + 1 } });
      publishedPolicyIds.push(row.id);

      const audit = await prisma.adminActivityLog.findFirstOrThrow({ where: { action: "consent_policy_published", targetId: row.id } });
      expect(audit).toMatchObject({ actorId: ids.super, targetType: "consent_policy", reason: "cp test: wording changed" });
      expect(audit.details).toMatchObject({ purpose: "terms", version: before + 1, previousVersion: before });

      // The member accepted the old version: required consent is outdated, nothing has been revoked.
      const view = (await request(app.getHttpServer()).get("/api/consent/mine").set(as("member")).expect(200)).body;
      expect(view.needsAction).toBe(true);
      expect(view.items.find((i: { purpose: string }) => i.purpose === "terms")).toMatchObject({ status: "granted", outdated: true, needsAction: true, acceptedVersion: before });

      // Registration with the old version is now refused.
      const old = (await acceptedConsents(prisma)).map((c) => (c.purpose === "terms" ? { ...c, policyVersion: before } : c));
      await request(app.getHttpServer())
        .post("/api/auth/register")
        .send({ firstName: "Old", lastName: "Form", email: `${PREFIX}oldform@example.com`, password: PASSWORD, ageConfirmed: true, consents: old })
        .expect(409);

      // Re-accepting the new version clears the flag and records a "recapture".
      await request(app.getHttpServer())
        .put("/api/consent/mine")
        .set(as("member"))
        .send({ source: "recapture", changes: [{ purpose: "terms", action: "granted", policyVersion: before + 1 }] })
        .expect(200);
      const after = (await request(app.getHttpServer()).get("/api/consent/mine").set(as("member")).expect(200)).body;
      expect(after.needsAction).toBe(false);
      expect(after.history[0]).toMatchObject({ purpose: "terms", action: "granted", policyVersion: before + 1, source: "recapture" });

      const admin = (await request(app.getHttpServer()).get("/api/admin/consent/policies").set(as("super")).expect(200)).body;
      expect(admin.find((p: { purpose: string; version: number }) => p.purpose === "terms" && p.version === before + 1)).toMatchObject({ grantedCount: 1 });
    });

    it("an account that is not yet approved can still read and accept consents", async () => {
      await request(app.getHttpServer()).get("/api/consent/mine").set(as("pending")).expect(200);
    });
  });

  describe("profile visibility", () => {
    const secretValues = [SECRET.bio, SECRET.linkedin, SECRET.certName, SECRET.phone, `${PREFIX}owner@example.com`];
    const leaks = (body: unknown) => secretValues.filter((v) => JSON.stringify(body).includes(v));

    it("defaults every field to private and lists what is always private", async () => {
      const res = await request(app.getHttpServer()).get("/api/users/profile/privacy").set(as("owner")).expect(200);
      expect(res.body.settings).toEqual({ bio: "private", professionalExperience: "private", socialLinks: "private", certifications: "private" });
      expect(res.body.alwaysPrivate.map((f: { field: string }) => f.field)).toEqual(expect.arrayContaining(["email", "whatsappNumber"]));
    });

    it("another member sees only name and avatar by default, never a private value", async () => {
      const res = await request(app.getHttpServer()).get(`/api/members/${ids.owner}`).set(as("viewer")).expect(200);
      expect(Object.keys(res.body).sort()).toEqual(["avatarUrl", "firstName", "id", "lastName"]);
      expect(leaks(res.body)).toEqual([]);
      expect(JSON.stringify(res.body)).not.toContain(SECRET.experience);
    });

    it("the owner and staff see everything the owner stored", async () => {
      for (const actor of ["owner", "admin", "super"]) {
        const res = await request(app.getHttpServer()).get(`/api/members/${ids.owner}`).set(as(actor)).expect(200);
        expect(res.body).toMatchObject({ bio: SECRET.bio, professionalExperience: SECRET.experience });
        expect(res.body.socialLinks.linkedin).toBe(SECRET.linkedin);
        expect(res.body.certifications[0].name).toBe(SECRET.certName);
        // Email and phone are not part of this view for anyone.
        expect(JSON.stringify(res.body)).not.toContain(SECRET.phone);
        expect(res.body.email).toBeUndefined();
      }
    });

    it("opening one field to members shows that field and only that field", async () => {
      const put = await request(app.getHttpServer()).put("/api/users/profile/privacy").set(as("owner")).send({ bio: "members" }).expect(200);
      expect(put.body.settings).toMatchObject({ bio: "members", socialLinks: "private" });
      const res = await request(app.getHttpServer()).get(`/api/members/${ids.owner}`).set(as("viewer")).expect(200);
      expect(res.body.bio).toBe(SECRET.bio);
      expect(res.body.professionalExperience).toBeUndefined();
      expect(res.body.socialLinks).toBeUndefined();
      expect(res.body.certifications).toBeUndefined();
      expect(leaks(res.body)).toEqual([SECRET.bio]);
    });

    it("closing it again hides it again, and the choice does not leak to a different member's profile", async () => {
      await request(app.getHttpServer()).put("/api/users/profile/privacy").set(as("owner")).send({ bio: "private" }).expect(200);
      const res = await request(app.getHttpServer()).get(`/api/members/${ids.owner}`).set(as("viewer")).expect(200);
      expect(res.body.bio).toBeUndefined();
      const other = await request(app.getHttpServer()).get(`/api/members/${ids.viewer}`).set(as("owner")).expect(200);
      expect(Object.keys(other.body).sort()).toEqual(["avatarUrl", "firstName", "id", "lastName"]);
    });

    it("rejects a public level and an empty change", async () => {
      await request(app.getHttpServer()).put("/api/users/profile/privacy").set(as("owner")).send({ bio: "public" }).expect(400);
      await request(app.getHttpServer()).put("/api/users/profile/privacy").set(as("owner")).send({}).expect(400);
    });

    it("an unapproved member's profile is not found for others", async () => {
      await request(app.getHttpServer()).get(`/api/members/${ids.pending}`).set(as("viewer")).expect(404);
    });

    it("a member cannot change another member's visibility", async () => {
      await request(app.getHttpServer()).put("/api/users/profile/privacy").set(as("viewer")).send({ bio: "members" }).expect(200);
      expect((await prisma.profilePrivacy.findUnique({ where: { userId: ids.owner } }))?.bio).toBe("private");
    });
  });
});
