import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { TokenService } from "../src/modules/identity/application/services/token.service";
import { toPublicUser, userWithRolesInclude } from "../src/modules/identity";

// TASK-027 / TEST-015: skill taxonomy, aliases, suggestion queue, member selection.
// Everything this file creates is named "<PREFIX>…" so cleanup never touches seeded skills.

jest.setTimeout(120_000);

describe("Skill taxonomy (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokens: TokenService;

  const PREFIX = `sktest${Date.now()}`;
  let n = 0;
  const nm = (label = "s") => `${PREFIX} ${label} ${++n}`;
  const cookies: Record<string, string> = {};
  let originalThreshold = 10;

  async function makeUser(label: string, role: "admin" | "member") {
    const user = await prisma.user.create({
      data: {
        firstName: "Skill",
        lastName: label,
        email: `${PREFIX}-${label}@example.com`,
        isApproved: true,
        emailVerified: true,
        roles: { create: [{ role: { connect: { name: role } } }] },
      },
      include: userWithRolesInclude,
    });
    cookies[label] = `accessToken=${tokens.signAccessToken(toPublicUser(user))}`;
    return user;
  }

  const as = (who: string) => ({
    get: (url: string) => request(app.getHttpServer()).get(url).set("Cookie", cookies[who]),
    post: (url: string, body: object = {}) => request(app.getHttpServer()).post(url).set("Cookie", cookies[who]).send(body),
    put: (url: string, body: object = {}) => request(app.getHttpServer()).put(url).set("Cookie", cookies[who]).send(body),
    del: (url: string) => request(app.getHttpServer()).delete(url).set("Cookie", cookies[who]),
  });
  const admin = () => as("admin");

  const version = async () => (await prisma.skillTaxonomyState.findUniqueOrThrow({ where: { id: "default" } })).version;
  const mk = async (name: string, level: "major" | "minor" | "micro", parentId?: string) =>
    (await admin().post("/api/skills", { name, level, parentId }).expect(201)).body as { id: string; name: string };

  async function cleanup() {
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await prisma.skillSuggestion.deleteMany({ where: { nameKey: { startsWith: PREFIX } } });
    // children first: the parent FK is RESTRICT
    for (const level of ["micro", "minor", "major"] as const) {
      await prisma.skill.deleteMany({ where: { nameKey: { startsWith: PREFIX }, level } });
    }
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
    await makeUser("admin", "admin");
    await makeUser("alice", "member");
    await makeUser("bob", "member");
    originalThreshold = (await prisma.skillTaxonomyState.findUniqueOrThrow({ where: { id: "default" } })).autoMergeThreshold;
  });

  afterAll(async () => {
    await prisma.skillTaxonomyState.update({ where: { id: "default" }, data: { autoMergeThreshold: originalThreshold } });
    await cleanup();
    await app.close();
  });

  describe("public read API", () => {
    it("lists the active taxonomy with aliases and a version, without signing in", async () => {
      const res = await request(app.getHttpServer()).get("/api/skills").expect(200);
      expect(res.body.version).toEqual(expect.any(Number));
      const names = res.body.skills.map((s: { name: string }) => s.name);
      expect(names).toEqual(expect.arrayContaining(["Networking", "Security", "Cloud", "OSPF"]));
      const ospf = res.body.skills.find((s: { name: string }) => s.name === "OSPF");
      expect(ospf.level).toBe("micro");
      expect(ospf.aliases.map((a: { alias: string }) => a.alias)).toContain("Open Shortest Path First");
      expect(res.body.skills.every((s: { status: string }) => s.status === "active")).toBe(true);
    });

    it("the seeded tree is well formed: majors have no parent, minors sit under majors, micros under minors", async () => {
      const { body } = await request(app.getHttpServer()).get("/api/skills").expect(200);
      const byId = new Map<string, { level: string; parentId: string | null }>(body.skills.map((s: { id: string; level: string; parentId: string | null }) => [s.id, s]));
      for (const s of body.skills as { level: string; parentId: string | null }[]) {
        if (s.level === "major") expect(s.parentId).toBeNull();
        if (s.level === "minor") expect(byId.get(s.parentId!)?.level).toBe("major");
        if (s.level === "micro") expect(byId.get(s.parentId!)?.level).toBe("minor");
      }
    });
  });

  describe("admin management and the hierarchy rules", () => {
    it("creates a major, minor and micro skill, bumping the version each time and auditing the change", async () => {
      const v0 = await version();
      const major = await mk(nm("major"), "major");
      const minor = await mk(nm("minor"), "minor", major.id);
      const micro = await admin()
        .post("/api/skills", { name: nm("micro"), level: "micro", parentId: minor.id, aliases: [nm("alias")], description: "d" })
        .expect(201);
      expect(micro.body.aliases).toHaveLength(1);
      expect(await version()).toBe(v0 + 3);
      const audit = await prisma.adminActivityLog.findMany({ where: { action: "skill_created", targetId: micro.body.id } });
      expect(audit).toHaveLength(1);
      expect((audit[0].details as { taxonomyVersion: number }).taxonomyVersion).toBe(v0 + 3);
    });

    it("rejects a wrong parent level, a missing parent and a parent on a major", async () => {
      const major = await mk(nm("major"), "major");
      const minor = await mk(nm("minor"), "minor", major.id);
      await admin().post("/api/skills", { name: nm("x"), level: "micro", parentId: major.id }).expect(400);
      await admin().post("/api/skills", { name: nm("x"), level: "minor", parentId: minor.id }).expect(400);
      await admin().post("/api/skills", { name: nm("x"), level: "minor" }).expect(400);
      await admin().post("/api/skills", { name: nm("x"), level: "major", parentId: major.id }).expect(400);
      await admin().post("/api/skills", { name: nm("x"), level: "minor", parentId: "00000000-0000-4000-8000-000000000000" }).expect(400);
    });

    it("names are unique ignoring case and spacing, across skills and aliases", async () => {
      const name = nm("Unique Name");
      const skill = await mk(name, "major");
      await admin().post("/api/skills", { name: name.toUpperCase(), level: "major" }).expect(409);
      await admin().post("/api/skills", { name: `  ${name.replace(" ", "   ")}  `, level: "major" }).expect(409);
      const alias = nm("alias");
      await admin().post(`/api/skills/${skill.id}/aliases`, { alias }).expect(201);
      await admin().post("/api/skills", { name: alias.toUpperCase(), level: "major" }).expect(409);
      const other = await mk(nm("other"), "major");
      await admin().post(`/api/skills/${other.id}/aliases`, { alias }).expect(409);
      await admin().post(`/api/skills/${other.id}/aliases`, { alias: name }).expect(409);
      await admin().put(`/api/skills/${other.id}`, { name }).expect(409);
    });

    it("rejects names with no letter or digit", async () => {
      await admin().post("/api/skills", { name: "!!", level: "major" }).expect(400);
      await admin().post("/api/skills", { name: "?? --", level: "major" }).expect(400);
    });

    it("updates a name, description and position, and moves a skill to another parent of the right level", async () => {
      const a = await mk(nm("major"), "major");
      const b = await mk(nm("major"), "major");
      const minor = await mk(nm("minor"), "minor", a.id);
      const renamed = nm("renamed");
      const res = await admin().put(`/api/skills/${minor.id}`, { name: renamed, description: "new", position: 7, parentId: b.id }).expect(200);
      expect(res.body).toMatchObject({ name: renamed, description: "new", position: 7, parentId: b.id });
      await admin().put(`/api/skills/${minor.id}`, { parentId: minor.id }).expect(400);
      await admin().put(`/api/skills/${a.id}`, { parentId: b.id }).expect(400);
      await admin().put("/api/skills/00000000-0000-4000-8000-000000000000", { position: 1 }).expect(404);
    });

    it("removes an alias and frees the name", async () => {
      const skill = await mk(nm("major"), "major");
      const alias = nm("alias");
      const withAlias = await admin().post(`/api/skills/${skill.id}/aliases`, { alias }).expect(201);
      const aliasId = withAlias.body.aliases[0].id;
      await admin().del(`/api/skills/${skill.id}/aliases/${aliasId}`).expect(200);
      await admin().del(`/api/skills/${skill.id}/aliases/${aliasId}`).expect(404);
      await admin().post(`/api/skills/${skill.id}/aliases`, { alias }).expect(201);
    });

    it("the admin list includes retired skills and member counts; members cannot read or write it", async () => {
      const skill = await mk(nm("major"), "major");
      const res = await admin().get("/api/skills/manage").expect(200);
      expect(res.body.autoMergeThreshold).toEqual(expect.any(Number));
      expect(res.body.skills.find((s: { id: string }) => s.id === skill.id).memberCount).toBe(0);
      await as("alice").get("/api/skills/manage").expect(403);
      await as("alice").post("/api/skills", { name: nm("x"), level: "major" }).expect(403);
      await as("alice").put(`/api/skills/${skill.id}`, { position: 3 }).expect(403);
      await as("alice").put(`/api/skills/${skill.id}/retire`, { reason: "not allowed to do this" }).expect(403);
    });
  });

  describe("retire is blocked while a skill is in use", () => {
    it("blocks retiring a skill a member has selected, then allows it once they drop it", async () => {
      const skill = await mk(nm("major"), "major");
      await as("alice").put("/api/skills/mine", { skills: [{ skillId: skill.id }] }).expect(200);
      const blocked = await admin().put(`/api/skills/${skill.id}/retire`, { reason: "retire while in use" }).expect(409);
      expect(blocked.body.message).toMatch(/1 member/);
      expect(await prisma.skill.findUniqueOrThrow({ where: { id: skill.id } })).toMatchObject({ status: "active" });

      await as("alice").put("/api/skills/mine", { skills: [] }).expect(200);
      await admin().put(`/api/skills/${skill.id}/retire`, { reason: "no longer used by anyone" }).expect(200);
    });

    it("blocks retiring a skill that still has active children", async () => {
      const major = await mk(nm("major"), "major");
      const minor = await mk(nm("minor"), "minor", major.id);
      const res = await admin().put(`/api/skills/${major.id}/retire`, { reason: "children still active" }).expect(409);
      expect(res.body.message).toMatch(/1 active child/);
      await admin().put(`/api/skills/${minor.id}/retire`, { reason: "retire the child first" }).expect(200);
      await admin().put(`/api/skills/${major.id}/retire`, { reason: "now the parent can go" }).expect(200);
    });

    it("needs a reason of 10+ characters, records it in the audit row, hides the skill from the public list and the picker, and can be restored", async () => {
      const skill = await mk(nm("major"), "major");
      await admin().put(`/api/skills/${skill.id}/retire`, {}).expect(400);
      await admin().put(`/api/skills/${skill.id}/retire`, { reason: "too short" }).expect(400);
      const reason = "Replaced by a better skill";
      await admin().put(`/api/skills/${skill.id}/retire`, { reason }).expect(200);
      const row = await prisma.adminActivityLog.findFirstOrThrow({ where: { action: "skill_retired", targetId: skill.id } });
      expect(row.reason).toBe(reason);

      const pub = await request(app.getHttpServer()).get("/api/skills").expect(200);
      expect(pub.body.skills.some((s: { id: string }) => s.id === skill.id)).toBe(false);
      await as("alice").put("/api/skills/mine", { skills: [{ skillId: skill.id }] }).expect(400);
      await admin().put(`/api/skills/${skill.id}/retire`, { reason }).expect(409);

      await admin().put(`/api/skills/${skill.id}/restore`).expect(200);
      await admin().put(`/api/skills/${skill.id}/restore`).expect(409);
      await as("alice").put("/api/skills/mine", { skills: [{ skillId: skill.id }] }).expect(200);
      await as("alice").put("/api/skills/mine", { skills: [] }).expect(200);
    });

    it("will not restore a skill under a retired parent", async () => {
      const major = await mk(nm("major"), "major");
      const minor = await mk(nm("minor"), "minor", major.id);
      await admin().put(`/api/skills/${minor.id}/retire`, { reason: "retire the child" }).expect(200);
      await admin().put(`/api/skills/${major.id}/retire`, { reason: "retire the parent" }).expect(200);
      await admin().put(`/api/skills/${minor.id}/restore`).expect(409);
    });
  });

  describe("member skill selection", () => {
    it("selects skills with the default visibility, keeps a stable order and replaces the whole set on save", async () => {
      const a = await mk(nm("major"), "major");
      const b = await mk(nm("major"), "major");
      const first = await as("alice").put("/api/skills/mine", { skills: [{ skillId: a.id }, { skillId: b.id, visibility: "private" }] }).expect(200);
      expect(first.body).toHaveLength(2);
      expect(first.body.find((s: { skillId: string }) => s.skillId === a.id)).toMatchObject({ visibility: "members", label: "self_declared" });
      expect(first.body.find((s: { skillId: string }) => s.skillId === b.id)).toMatchObject({ visibility: "private" });

      const second = await as("alice").put("/api/skills/mine", { skills: [{ skillId: b.id, visibility: "public" }] }).expect(200);
      expect(second.body).toHaveLength(1);
      expect(second.body[0]).toMatchObject({ skillId: b.id, visibility: "public" });
      expect((await as("alice").get("/api/skills/mine").expect(200)).body).toHaveLength(1);
      await as("alice").put("/api/skills/mine", { skills: [] }).expect(200);
    });

    it("allows 25 skills and refuses 26, duplicates, unknown ids and bad visibility", async () => {
      const made: string[] = [];
      for (let i = 0; i < 26; i++) made.push((await mk(nm("cap"), "major")).id);
      await as("alice").put("/api/skills/mine", { skills: made.slice(0, 25).map((skillId) => ({ skillId })) }).expect(200);
      await as("alice").put("/api/skills/mine", { skills: made.map((skillId) => ({ skillId })) }).expect(400);
      await as("alice").put("/api/skills/mine", { skills: [{ skillId: made[0] }, { skillId: made[0] }] }).expect(400);
      await as("alice").put("/api/skills/mine", { skills: [{ skillId: "00000000-0000-4000-8000-000000000000" }] }).expect(400);
      await as("alice").put("/api/skills/mine", { skills: [{ skillId: made[0], visibility: "everyone" }] }).expect(400);
      // a refused save changes nothing
      expect((await as("alice").get("/api/skills/mine").expect(200)).body).toHaveLength(25);
      await as("alice").put("/api/skills/mine", { skills: [] }).expect(200);
    });

    it("shows other members only the skills the owner made public or members-visible", async () => {
      const pub = await mk(nm("public"), "major");
      const mem = await mk(nm("members"), "major");
      const priv = await mk(nm("private"), "major");
      await as("alice")
        .put("/api/skills/mine", {
          skills: [
            { skillId: pub.id, visibility: "public" },
            { skillId: mem.id, visibility: "members" },
            { skillId: priv.id, visibility: "private" },
          ],
        })
        .expect(200);
      const alice = await prisma.user.findFirstOrThrow({ where: { email: `${PREFIX}-alice@example.com` } });

      const seenByBob = (await as("bob").get(`/api/skills/members/${alice.id}`).expect(200)).body.map((s: { skillId: string }) => s.skillId);
      expect(seenByBob.sort()).toEqual([pub.id, mem.id].sort());
      const seenBySelf = (await as("alice").get(`/api/skills/members/${alice.id}`).expect(200)).body.map((s: { skillId: string }) => s.skillId);
      expect(seenBySelf.sort()).toEqual([pub.id, mem.id, priv.id].sort());
      // staff get no special view of a member's private choices
      const seenByAdmin = (await admin().get(`/api/skills/members/${alice.id}`).expect(200)).body.map((s: { skillId: string }) => s.skillId);
      expect(seenByAdmin).not.toContain(priv.id);
      await as("bob").get("/api/skills/members/00000000-0000-4000-8000-000000000000").expect(404);
      await request(app.getHttpServer()).get(`/api/skills/members/${alice.id}`).expect(401);
      await as("alice").put("/api/skills/mine", { skills: [] }).expect(200);
    });

    it("needs a session", async () => {
      await request(app.getHttpServer()).get("/api/skills/mine").expect(401);
      await request(app.getHttpServer()).put("/api/skills/mine").send({ skills: [] }).expect(401);
    });
  });

  describe("suggestion queue (PRD-011, TEST-015)", () => {
    it("a new name opens a suggestion; the same member again, or another member, is counted once each", async () => {
      const name = nm("brand new");
      const first = await as("alice").post("/api/skills/suggestions", { name }).expect(201);
      expect(first.body.outcome).toBe("created");
      expect(first.body.suggestion.sightings).toBe(1);

      const again = await as("alice").post("/api/skills/suggestions", { name: name.toUpperCase() }).expect(201);
      expect(again.body.outcome).toBe("already_counted");
      expect(again.body.suggestion.sightings).toBe(1);

      const other = await as("bob").post("/api/skills/suggestions", { name: `  ${name}  ` }).expect(201);
      expect(other.body.outcome).toBe("counted");
      expect(other.body.suggestion.sightings).toBe(2);

      const queue = await admin().get("/api/skills/suggestions").expect(200);
      expect(queue.body.find((s: { id: string }) => s.id === first.body.suggestion.id)).toMatchObject({ status: "pending", sightings: 2 });
      await as("alice").get("/api/skills/suggestions").expect(403);
    });

    it("a name already in the taxonomy (skill or alias) is answered as existing, not queued", async () => {
      const skill = await mk(nm("known"), "major");
      const alias = nm("known alias");
      await admin().post(`/api/skills/${skill.id}/aliases`, { alias }).expect(201);
      for (const name of [skill.name.toUpperCase(), alias]) {
        const res = await as("alice").post("/api/skills/suggestions", { name }).expect(201);
        expect(res.body).toMatchObject({ outcome: "exists", skillId: skill.id });
      }
      expect(await prisma.skillSuggestion.count({ where: { nameKey: { in: [skill.name.toLowerCase(), alias.toLowerCase()] } } })).toBe(0);
    });

    it("a clear match merges into an alias at the threshold, and not before", async () => {
      await prisma.skillTaxonomyState.update({ where: { id: "default" }, data: { autoMergeThreshold: 2 } });
      const skill = await mk(`${PREFIX} OSPF v2`, "major");
      const v0 = await version();
      // same letters and digits, different spelling: a clear match
      const variant = `${PREFIX} ospf-v2`;
      const one = await as("alice").post("/api/skills/suggestions", { name: variant }).expect(201);
      expect(one.body.suggestion).toMatchObject({ status: "pending", sightings: 1, matchSkillId: skill.id });
      expect(await version()).toBe(v0);

      const two = await as("bob").post("/api/skills/suggestions", { name: variant }).expect(201);
      expect(two.body.suggestion).toMatchObject({ status: "merged", sightings: 2, resolvedSkillId: skill.id });
      expect(await version()).toBe(v0 + 1);
      const aliases = await prisma.skillAlias.findMany({ where: { skillId: skill.id } });
      expect(aliases.map((a) => a.alias)).toEqual([variant]);
      const row = await prisma.adminActivityLog.findFirstOrThrow({ where: { action: "skill_suggestion_auto_merged", targetId: one.body.suggestion.id } });
      expect(row.actorId).toBeNull();
      expect(row.reason).toMatch(/threshold 2/);

      // once merged the name simply exists
      const after = await as("alice").post("/api/skills/suggestions", { name: variant }).expect(201);
      expect(after.body.outcome).toBe("exists");
      await prisma.skillTaxonomyState.update({ where: { id: "default" }, data: { autoMergeThreshold: originalThreshold } });
    });

    it("a name with no clear match never merges by itself, however often it is seen", async () => {
      await prisma.skillTaxonomyState.update({ where: { id: "default" }, data: { autoMergeThreshold: 2 } });
      const name = nm("no match at all");
      await as("alice").post("/api/skills/suggestions", { name }).expect(201);
      const two = await as("bob").post("/api/skills/suggestions", { name }).expect(201);
      expect(two.body.suggestion).toMatchObject({ status: "pending", sightings: 2, matchSkillId: null });
      await prisma.skillTaxonomyState.update({ where: { id: "default" }, data: { autoMergeThreshold: originalThreshold } });
    });

    it("an admin adds a suggestion as a skill, merges one into an alias, or rejects one with a reason", async () => {
      await makeUser("dave", "member");
      const addName = nm("to add");
      const added = (await as("dave").post("/api/skills/suggestions", { name: addName }).expect(201)).body.suggestion;
      const major = await mk(nm("parent"), "major");
      await admin().put(`/api/skills/suggestions/${added.id}/add`, { level: "minor" }).expect(400); // needs a parent
      const addRes = await admin().put(`/api/skills/suggestions/${added.id}/add`, { level: "minor", parentId: major.id }).expect(200);
      expect(addRes.body.suggestion).toMatchObject({ status: "added", resolvedSkillId: addRes.body.skill.id });
      expect(addRes.body.skill).toMatchObject({ name: addName, level: "minor", parentId: major.id });

      const target = await mk(nm("target"), "major");
      const mergeName = nm("to merge");
      const toMerge = (await as("dave").post("/api/skills/suggestions", { name: mergeName }).expect(201)).body.suggestion;
      await admin().put(`/api/skills/suggestions/${toMerge.id}/merge`, { skillId: "00000000-0000-4000-8000-000000000000" }).expect(404);
      const mergeRes = await admin().put(`/api/skills/suggestions/${toMerge.id}/merge`, { skillId: target.id }).expect(200);
      expect(mergeRes.body).toMatchObject({ status: "merged", resolvedSkillId: target.id });
      expect((await prisma.skillAlias.findMany({ where: { skillId: target.id } })).map((a) => a.alias)).toEqual([mergeName]);

      const rejName = nm("to reject");
      const toReject = (await as("dave").post("/api/skills/suggestions", { name: rejName }).expect(201)).body.suggestion;
      await admin().put(`/api/skills/suggestions/${toReject.id}/reject`, {}).expect(400);
      await admin().put(`/api/skills/suggestions/${toReject.id}/reject`, { reason: "too short" }).expect(400);
      const reason = "Not a skill, it is a product name";
      const rejRes = await admin().put(`/api/skills/suggestions/${toReject.id}/reject`, { reason }).expect(200);
      expect(rejRes.body).toMatchObject({ status: "rejected", rejectReason: reason });
      expect((await prisma.adminActivityLog.findFirstOrThrow({ where: { action: "skill_suggestion_rejected", targetId: toReject.id } })).reason).toBe(reason);

      // handled suggestions cannot be handled again, and a declined name stays declined
      await admin().put(`/api/skills/suggestions/${toReject.id}/reject`, { reason }).expect(409);
      await admin().put(`/api/skills/suggestions/${added.id}/merge`, { skillId: target.id }).expect(409);
      await as("bob").post("/api/skills/suggestions", { name: rejName }).expect(409);
      const merged = await admin().get("/api/skills/suggestions?status=merged").expect(200);
      expect(merged.body.some((s: { id: string }) => s.id === toMerge.id)).toBe(true);
      await admin().get("/api/skills/suggestions?status=bogus").expect(400);
    });

    it("limits how many new names one member can open a day", async () => {
      const carol = await makeUser("carol", "member");
      for (let i = 0; i < 5; i++) await as("carol").post("/api/skills/suggestions", { name: nm("cap") }).expect(201);
      await as("carol").post("/api/skills/suggestions", { name: nm("cap") }).expect(409);
      // counting an existing suggestion is not a new name
      const existing = await prisma.skillSuggestion.findFirstOrThrow({ where: { suggestedById: carol.id } });
      const res = await as("carol").post("/api/skills/suggestions", { name: existing.name }).expect(201);
      expect(res.body.outcome).toBe("already_counted");
    });

    it("validates the suggestion body and needs a session", async () => {
      await as("alice").post("/api/skills/suggestions", {}).expect(400);
      await as("alice").post("/api/skills/suggestions", { name: "!" }).expect(400);
      await as("alice").post("/api/skills/suggestions", { name: "??" }).expect(400);
      await request(app.getHttpServer()).post("/api/skills/suggestions").send({ name: "Anything" }).expect(401);
    });
  });
});
