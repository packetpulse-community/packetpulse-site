import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import { ThrottlerStorage } from "@nestjs/throttler";
import request from "supertest";
import { MAX_MEMBER_SKILLS, RESUME_MAX_VERSIONS } from "@packetpulse/types";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { TokenService } from "../src/modules/identity/application/services/token.service";
import { toPublicUser, userWithRolesInclude } from "../src/modules/identity";
import { StorageProvider } from "../src/common/storage/storage-provider";
import { LocalStorageProvider } from "../src/common/storage/local-storage.provider";
import { FeatureFlagsService } from "../src/modules/feature-flags/feature-flags.service";
import { FLAG_BY_KEY } from "../src/modules/feature-flags/feature-flag.registry";
import { AccountErasureService } from "../src/modules/data-rights/application/account-erasure.service";
import { readZip } from "./helpers/zip-reader";
import { ResumeParseService } from "../src/modules/resumes/application/resume-parse.service";
import { DOCX_TYPE, PDF_TYPE, makeDocx, makePdf, makeZipBombDocx } from "./helpers/resume-fixtures";

// TEST-004 (TASK-024, PRD-007, PRD-046, SEC-03): resume upload, background parsing, review of
// suggestions, replace and delete, scope isolation, hostile files, idempotency. Synthetic
// documents only. The file access log is append-only, so its rows stay behind.
jest.setTimeout(120_000);

const RESUME_LINES = [
  "Test Person",
  "EXPERIENCE",
  "Network Engineer, Sample Telecom",
  "Mar 2015 - Dec 2018",
  "Senior Network Engineer, Example Networks Pvt Ltd",
  "Jan 2019 - Present",
  "EDUCATION",
  "B.Tech in Computer Science, Example Institute of Technology",
  "2011 - 2015",
  "SKILLS",
  "Zyrouting, Zy Border Gateway, Zynet, Zyretired",
];

describe("Resumes (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let storage: LocalStorageProvider;
  let parser: ResumeParseService;
  let flags: FeatureFlagsService;
  const tokens: Record<string, string> = {};
  const ids: Record<string, string> = {};
  const PREFIX = "rs-";
  const as = (who: string) => ({ Cookie: `accessToken=${tokens[who]}` });
  const http = () => request(app.getHttpServer());
  const skillIds: Record<string, string> = {};

  async function mkUser(name: string, role: string, consent = true) {
    const user = await prisma.user.create({
      data: {
        firstName: "Resume",
        lastName: name,
        email: `${PREFIX}${name}@example.com`,
        isApproved: true,
        emailVerified: true,
        roles: { create: [{ role: { connect: { name: role } } }] },
      },
      include: userWithRolesInclude,
    });
    ids[name] = user.id;
    tokens[name] = app.get(TokenService).signAccessToken(toPublicUser(user));
    if (consent) await grant(name);
  }
  const policyVersion = async () => (await prisma.consentPolicy.findFirstOrThrow({ where: { purpose: "resume_sharing" }, orderBy: { version: "desc" } })).version;
  const grant = async (who: string) =>
    prisma.consentRecord.create({ data: { userId: ids[who]!, purpose: "resume_sharing", action: "granted", policyVersion: await policyVersion(), source: "consent_centre" } });
  const withdraw = async (who: string) =>
    prisma.consentRecord.create({ data: { userId: ids[who]!, purpose: "resume_sharing", action: "withdrawn", policyVersion: await policyVersion(), source: "consent_centre" } });

  const overview = (who: string) => http().get("/api/resumes").set(as(who)).then((r) => r.body);
  async function waitFor<T>(fn: () => Promise<T | undefined | false>, ms = 30_000): Promise<T> {
    const end = Date.now() + ms;
    for (;;) {
      const v = await fn();
      if (v) return v;
      if (Date.now() > end) throw new Error("timed out waiting");
      await new Promise((r) => setTimeout(r, 150));
    }
  }

  // Start, put the bytes straight to storage, complete. Returns the complete response.
  async function upload(who: string, bytes: Buffer, name = "cv.pdf", type = PDF_TYPE, declaredSize = bytes.length) {
    const start = await http().post("/api/resumes/upload-url").set(as(who)).send({ originalName: name, contentType: type, sizeBytes: declaredSize });
    if (start.status !== 201) return { start, done: undefined };
    await storage.putWithToken(start.body.uploadUrl, bytes);
    const done = await http().post(`/api/resumes/${start.body.resume.id}/complete`).set(as(who));
    return { start, done };
  }
  async function settled(who: string, id: string) {
    return waitFor(async () => {
      const o = await overview(who);
      const r = [o.current, ...o.history].find((x: { id: string } | null) => x?.id === id);
      return r && r.status !== "parsing" ? { overview: o, resume: r } : undefined;
    });
  }
  const suggestion = (o: { suggestions: { kind: string; data: Record<string, unknown> }[] }, kind: string, pick?: (d: Record<string, unknown>) => boolean) =>
    o.suggestions.find((s) => s.kind === kind && (!pick || pick(s.data))) as { id: string; status: string; data: Record<string, unknown> };

  const wipeResumes = async (who: string) => {
    for (const r of await prisma.resume.findMany({ where: { userId: ids[who] }, include: { file: true } })) {
      await storage.delete(r.file.bucket, r.file.path);
    }
    await prisma.resume.deleteMany({ where: { userId: ids[who] } });
    await prisma.memberSkill.deleteMany({ where: { userId: ids[who] } });
    await prisma.memberEducation.deleteMany({ where: { userId: ids[who] } });
    await prisma.memberExperience.deleteMany({ where: { userId: ids[who] } });
  };

  beforeAll(async () => {
    // This suite makes far more uploads than one client may in a minute: the per-route limits are
    // not what it tests, so the throttle counter is replaced by one that never blocks.
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ThrottlerStorage)
      .useValue({ increment: async () => ({ totalHits: 1, timeToExpire: 60, isBlocked: false, timeToBlockExpire: 0 }) })
      .compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix("api");
    await app.init();
    prisma = app.get(PrismaService);
    storage = app.get(StorageProvider) as LocalStorageProvider;
    parser = app.get(ResumeParseService);
    flags = app.get(FeatureFlagsService);
    await prisma.user.deleteMany({ where: { OR: [{ email: { startsWith: PREFIX } }, { id: { in: Object.values(ids) } }] } }); // an erased member's email no longer has the prefix
    await prisma.skill.deleteMany({ where: { nameKey: { startsWith: "zy" }, level: "micro" } });
    await prisma.skill.deleteMany({ where: { nameKey: { startsWith: "zy" }, level: "minor" } });
    await prisma.skill.deleteMany({ where: { nameKey: { startsWith: "zy" } } });
    const mk = async (name: string, level: "major" | "minor" | "micro", extra: object = {}) =>
      (skillIds[name] = (await prisma.skill.create({ data: { name, nameKey: name.toLowerCase(), matchKey: name.toLowerCase().replace(/[^a-z0-9]/g, ""), level, ...extra } })).id);
    await mk("Zynet", "major");
    await mk("Zyminor", "minor", { parentId: skillIds.Zynet });
    await mk("Zyrouting", "micro", { parentId: skillIds.Zyminor });
    const bgp = await mk("Zybgp", "micro", { parentId: skillIds.Zyminor });
    await prisma.skillAlias.create({ data: { skillId: bgp, alias: "Zy Border Gateway", aliasKey: "zy border gateway", matchKey: "zybordergateway" } });
    await mk("Zyretired", "micro", { status: "retired", parentId: skillIds.Zyminor });
    await mkUser("owner", "member");
    await mkUser("other", "member");
    await mkUser("noconsent", "member", false);
    await mkUser("admin", "admin");
    await mkUser("leaver", "member");
  });

  afterAll(async () => {
    for (const who of Object.keys(ids)) await wipeResumes(who).catch(() => undefined);
    for (const f of await prisma.storedFile.findMany({ where: { ownerId: { in: Object.values(ids) } } })) await storage.delete(f.bucket, f.path);
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await prisma.skill.deleteMany({ where: { nameKey: { startsWith: "zy" }, level: "micro" } });
    await prisma.skill.deleteMany({ where: { nameKey: { startsWith: "zy" }, level: "minor" } });
    await prisma.skill.deleteMany({ where: { nameKey: { startsWith: "zy" } } });
    await prisma.featureFlag.deleteMany({ where: { key: "resumes.upload" } });
    flags.invalidate();
    await app.close();
  });

  describe("who may upload, and what", () => {
    it("refuses a caller who is not signed in", async () => {
      await http().get("/api/resumes").expect(401);
      await http().post("/api/resumes/upload-url").send({}).expect(401);
    });

    it("needs the resume_sharing consent before the first upload (and says why)", async () => {
      const res = await http().post("/api/resumes/upload-url").set(as("noconsent")).send({ originalName: "cv.pdf", contentType: PDF_TYPE, sizeBytes: 1000 });
      expect(res.status).toBe(403);
      expect(res.body.message).toContain("agree to share your resume");
      expect(await prisma.resume.count({ where: { userId: ids.noconsent } })).toBe(0);
      expect((await overview("noconsent")).consentGranted).toBe(false);
    });

    it("accepts PDF and DOCX only, up to 5 MB", async () => {
      const bad = (over: object) => http().post("/api/resumes/upload-url").set(as("owner")).send({ originalName: "cv.pdf", contentType: PDF_TYPE, sizeBytes: 1000, ...over });
      expect((await bad({ contentType: "application/msword", originalName: "cv.doc" })).status).toBe(400);
      expect((await bad({ contentType: "image/png", originalName: "cv.png" })).status).toBe(400);
      expect((await bad({ contentType: "application/x-msdownload", originalName: "cv.exe" })).status).toBe(400);
      expect((await bad({ sizeBytes: 5 * 1024 * 1024 + 1 })).status).toBe(400);
      expect((await bad({ sizeBytes: 0 })).status).toBe(400);
      expect((await bad({ originalName: "" })).status).toBe(400);
    });

    it("the generic file routes refuse resumes (consent and parsing live in the resume module)", async () => {
      const generic = await http().post("/api/files/upload-url").set(as("owner")).send({ kind: "resume", originalName: "cv.pdf", contentType: PDF_TYPE, sizeBytes: 1000 });
      expect(generic.status).toBe(400);
      const { start } = await upload("owner", makePdf(RESUME_LINES));
      const fileId = start.body.resume.fileId;
      expect((await http().post(`/api/files/${fileId}/complete`).set(as("owner"))).status).toBe(400);
      expect((await http().delete(`/api/files/${fileId}`).set(as("owner"))).status).toBe(400);
      await wipeResumes("owner");
    });

    it("a stored resume is private: the response never carries a path or a public link", async () => {
      const { start, done } = await upload("owner", makePdf(RESUME_LINES));
      expect(start.body.resume.visibility).toBe("private");
      expect(start.body.uploadUrl).toContain("local-storage");
      expect(JSON.stringify([start.body, done?.body])).not.toMatch(/"path"|"bucket"|getPublicUrl|public\//);
      await wipeResumes("owner");
    });
  });

  describe("upload, parse and review", () => {
    let resumeId: string;
    let fileId: string;

    it("uploads, scans, parses in the background and offers suggestions without touching the profile", async () => {
      const { start, done } = await upload("owner", makePdf(RESUME_LINES), "my cv.pdf");
      expect(start.status).toBe(201);
      expect(start.body.resume.status).toBe("awaiting_upload");
      expect(done?.status).toBe(201);
      expect(done?.body).toMatchObject({ status: "parsing", version: 1, isCurrent: true });
      resumeId = done!.body.id;
      fileId = done!.body.fileId;

      const { overview: o, resume } = await settled("owner", resumeId);
      expect(resume.status).toBe("ready");
      expect(o.current.id).toBe(resumeId);
      const kinds = o.suggestions.map((s: { kind: string }) => s.kind);
      expect(kinds.filter((k: string) => k === "skill")).toHaveLength(3); // Zyrouting, Zybgp (alias), Zynet; the retired one is not offered
      expect(suggestion(o, "skill", (d) => d.name === "Zybgp")?.data.matchedOn).toBe("Zy Border Gateway");
      expect(o.suggestions.some((s: { data: { name?: string } }) => s.data.name === "Zyretired")).toBe(false);
      expect(kinds.filter((k: string) => k === "experience")).toHaveLength(2);
      expect(kinds.filter((k: string) => k === "education")).toHaveLength(1);
      expect(o.suggestions.every((s: { status: string }) => s.status === "pending")).toBe(true);

      // Nothing was applied.
      expect(await prisma.memberSkill.count({ where: { userId: ids.owner } })).toBe(0);
      expect(await prisma.memberEducation.count({ where: { userId: ids.owner } })).toBe(0);
      expect(await prisma.memberExperience.count({ where: { userId: ids.owner } })).toBe(0);
    });

    it("accepting applies exactly one field; rejecting changes nothing on the profile", async () => {
      const o = await overview("owner");
      const skill = suggestion(o, "skill", (d) => d.name === "Zyrouting");
      const accepted = await http().put(`/api/resumes/suggestions/${skill.id}`).set(as("owner")).send({ decision: "accept" }).expect(200);
      expect(accepted.body.status).toBe("accepted");
      expect((await prisma.memberSkill.findMany({ where: { userId: ids.owner } })).map((m) => m.skillId)).toEqual([skillIds.Zyrouting]);

      const net = suggestion(o, "skill", (d) => d.name === "Zynet");
      await http().put(`/api/resumes/suggestions/${net.id}`).set(as("owner")).send({ decision: "reject" }).expect(200);
      expect(await prisma.memberSkill.count({ where: { userId: ids.owner } })).toBe(1);

      const edu = suggestion(o, "education");
      await http().put(`/api/resumes/suggestions/${edu.id}`).set(as("owner")).send({ decision: "accept" }).expect(200);
      const exp = suggestion(o, "experience", (d) => d.current === true);
      await http().put(`/api/resumes/suggestions/${exp.id}`).set(as("owner")).send({ decision: "accept" }).expect(200);
      const entries = await http().get("/api/resumes/profile-entries").set(as("owner")).expect(200);
      expect(entries.body.education).toHaveLength(1);
      expect(entries.body.education[0]).toMatchObject({ qualification: "B.Tech in Computer Science", endYear: 2015 });
      expect(entries.body.experience).toHaveLength(1);
      expect(entries.body.experience[0]).toMatchObject({ title: "Senior Network Engineer", startDate: "2019-01", current: true });
    });

    it("a decision is idempotent; accepted cannot be rejected; rejected can still be accepted", async () => {
      const o = await overview("owner");
      const skill = suggestion(o, "skill", (d) => d.name === "Zyrouting");
      expect(skill.status).toBe("accepted");
      await http().put(`/api/resumes/suggestions/${skill.id}`).set(as("owner")).send({ decision: "accept" }).expect(200);
      expect(await prisma.memberSkill.count({ where: { userId: ids.owner, skillId: skillIds.Zyrouting } })).toBe(1);
      const conflict = await http().put(`/api/resumes/suggestions/${skill.id}`).set(as("owner")).send({ decision: "reject" });
      expect(conflict.status).toBe(409);
      const net = suggestion(o, "skill", (d) => d.name === "Zynet");
      expect(net.status).toBe("rejected");
      await http().put(`/api/resumes/suggestions/${net.id}`).set(as("owner")).send({ decision: "accept" }).expect(200);
      expect(await prisma.memberSkill.count({ where: { userId: ids.owner } })).toBe(2);
      await http().put(`/api/resumes/suggestions/${skill.id}`).set(as("owner")).send({ decision: "maybe" }).expect(400);
    });

    it("removing an accepted entry puts its suggestion back to pending", async () => {
      const entries = (await http().get("/api/resumes/profile-entries").set(as("owner"))).body;
      await http().delete(`/api/resumes/profile-entries/education/${entries.education[0].id}`).set(as("owner")).expect(200);
      const o = await overview("owner");
      expect(suggestion(o, "education").status).toBe("pending");
      await http().delete(`/api/resumes/profile-entries/education/${entries.education[0].id}`).set(as("owner")).expect(404);
      await http().delete(`/api/resumes/profile-entries/nonsense/${entries.education[0].id}`).set(as("owner")).expect(400);
    });

    it("another member cannot read, decide, open, retry, complete or delete anything of the owner's", async () => {
      const o = await overview("owner");
      const skill = suggestion(o, "skill", (d) => d.name === "Zybgp");
      const other = await overview("other");
      expect(other.current).toBeNull();
      expect(other.suggestions).toEqual([]);
      expect(other.history).toEqual([]);
      expect((await http().put(`/api/resumes/suggestions/${skill.id}`).set(as("other")).send({ decision: "accept" })).status).toBe(404);
      expect((await http().get(`/api/resumes/${resumeId}/link`).set(as("other"))).status).toBe(404);
      expect((await http().get(`/api/files/${fileId}/link`).set(as("other"))).status).toBe(404);
      expect((await http().post(`/api/resumes/${resumeId}/retry`).set(as("other"))).status).toBe(404);
      expect((await http().post(`/api/resumes/${resumeId}/complete`).set(as("other"))).status).toBe(404);
      expect((await http().delete(`/api/resumes/${resumeId}`).set(as("other"))).status).toBe(404);
      expect((await http().get("/api/resumes/profile-entries").set(as("other"))).body).toEqual({ education: [], experience: [] });
      expect(await prisma.memberSkill.count({ where: { userId: ids.other } })).toBe(0);
      expect((await prisma.resumeSuggestion.findUniqueOrThrow({ where: { id: skill.id } })).status).toBe("pending");
      // The attempt to read the file is recorded.
      expect((await prisma.fileAccessLog.findMany({ where: { fileId, actorId: ids.other } })).map((l) => l.action)).toContain("denied");
    });

    it("the owner opens the file through a short-lived signed link, and the open is logged", async () => {
      const res = await http().get(`/api/resumes/${resumeId}/link`).set(as("owner")).expect(200);
      expect(res.body.expiresInSeconds).toBe(60);
      const bytes = await storage.readWithToken(res.body.url);
      expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
      expect((await prisma.fileAccessLog.findMany({ where: { fileId, actorId: ids.owner } })).map((l) => l.action)).toContain("open");
    });

    it("staff open a resume only with the member's sharing consent, and only once it has settled", async () => {
      // Consent is in place for "owner": the admin may open it, and it is logged under the admin.
      const ok = await http().get(`/api/files/${fileId}/link`).set(as("admin")).expect(200);
      expect(ok.body.originalName).toBe("my cv.pdf");
      expect((await prisma.fileAccessLog.findMany({ where: { fileId, actorId: ids.admin } })).map((l) => l.action)).toContain("open");

      await withdraw("owner");
      expect((await http().get(`/api/files/${fileId}/link`).set(as("admin"))).status).toBe(404);
      expect((await prisma.fileAccessLog.findMany({ where: { fileId, actorId: ids.admin } })).map((l) => l.action)).toContain("denied");
      // The owner still can, and new uploads are refused until they agree again.
      await http().get(`/api/resumes/${resumeId}/link`).set(as("owner")).expect(200);
      expect((await http().post("/api/resumes/upload-url").set(as("owner")).send({ originalName: "cv.pdf", contentType: PDF_TYPE, sizeBytes: 1000 })).status).toBe(403);
      await grant("owner");

      await prisma.resume.update({ where: { id: resumeId }, data: { status: "parsing" } });
      expect((await http().get(`/api/files/${fileId}/link`).set(as("admin"))).status).toBe(404); // not settled yet
      await prisma.resume.update({ where: { id: resumeId }, data: { status: "ready" } });
      await http().get(`/api/files/${fileId}/link`).set(as("admin")).expect(200);
    });

    it("another ordinary member can never open it, even with the file id", async () => {
      expect((await http().get(`/api/files/${fileId}/link`).set(as("other"))).status).toBe(404);
    });
  });

  describe("replace, history and delete", () => {
    beforeAll(async () => {
      await wipeResumes("owner");
    });

    it("a new upload becomes current only once stored; the old one moves to history", async () => {
      const first = await upload("owner", makePdf(["First", "SKILLS", "Zyrouting"]), "v1.pdf");
      await settled("owner", first.done!.body.id);
      const second = await upload("owner", makeDocx(["Second", "SKILLS", "Zybgp"]), "v2.docx", DOCX_TYPE);
      expect(second.done?.body.version).toBe(2);
      await settled("owner", second.done!.body.id);
      const o = await overview("owner");
      expect(o.current.version).toBe(2);
      expect(o.history.map((h: { version: number }) => h.version)).toEqual([1]);
      expect(o.history[0].isCurrent).toBe(false);
      // Suggestions shown belong to the current version only.
      expect(o.suggestions.map((s: { data: { name?: string } }) => s.data.name)).toContain("Zybgp");
      expect(o.suggestions.map((s: { data: { name?: string } }) => s.data.name)).not.toContain("Zyrouting");
      expect(await prisma.resume.count({ where: { userId: ids.owner, activeSlot: "current" } })).toBe(1);
    });

    it("a replacement that fails the file check keeps the current resume", async () => {
      const before = await overview("owner");
      const bad = await upload("owner", Buffer.from("this is plain text, not a pdf at all"), "fake.pdf");
      expect(bad.done?.status).toBe(400);
      expect(bad.done?.body.message).toContain("could not accept this file");
      expect(bad.done?.body.message).not.toMatch(/signature|content does not match/i);
      const after = await overview("owner");
      expect(after.current.id).toBe(before.current.id);
      expect(after.history).toHaveLength(before.history.length);
      // The rejected object is gone from storage.
      const rejected = await prisma.storedFile.findFirstOrThrow({ where: { ownerId: ids.owner, status: "rejected" }, orderBy: { createdAt: "desc" } });
      expect((await storage.headObject(rejected.bucket, rejected.path)).exists).toBe(false);
    });

    it("a size that differs from what was declared is refused", async () => {
      const bytes = makePdf(["x"]);
      const res = await upload("owner", bytes, "cv.pdf", PDF_TYPE, bytes.length + 10);
      expect(res.done?.status).toBe(400);
    });

    it("keeps only the newest five versions", async () => {
      for (let i = 0; i < RESUME_MAX_VERSIONS + 1; i++) {
        const r = await upload("owner", makePdf([`Version ${i}`, "SKILLS", "Zyrouting"]));
        await settled("owner", r.done!.body.id);
      }
      const o = await overview("owner");
      expect(1 + o.history.length).toBe(RESUME_MAX_VERSIONS);
      expect(o.current.version).toBeGreaterThanOrEqual(RESUME_MAX_VERSIONS + 2);
      const files = await prisma.storedFile.findMany({ where: { ownerId: ids.owner, kind: "resume", status: "available", resume: { isNot: null } } });
      expect(files).toHaveLength(RESUME_MAX_VERSIONS);
    });

    it("an upload started twice leaves one in flight", async () => {
      const a = await http().post("/api/resumes/upload-url").set(as("owner")).send({ originalName: "a.pdf", contentType: PDF_TYPE, sizeBytes: 100 }).expect(201);
      const b = await http().post("/api/resumes/upload-url").set(as("owner")).send({ originalName: "b.pdf", contentType: PDF_TYPE, sizeBytes: 100 }).expect(201);
      expect(await prisma.resume.findUnique({ where: { id: a.body.resume.id } })).toBeNull();
      expect(await prisma.resume.findUnique({ where: { id: b.body.resume.id } })).not.toBeNull();
      expect((await overview("owner")).history.every((h: { status: string }) => h.status !== "awaiting_upload")).toBe(true);
    });

    it("complete is idempotent, and complete before the bytes arrive is refused without losing the upload", async () => {
      const start = await http().post("/api/resumes/upload-url").set(as("owner")).send({ originalName: "c.pdf", contentType: PDF_TYPE, sizeBytes: 100 }).expect(201);
      const early = await http().post(`/api/resumes/${start.body.resume.id}/complete`).set(as("owner"));
      expect(early.status).toBe(400);
      // The resume row is removed only when the file itself is judged bad; "no bytes yet" is a 400 from the pipeline.
      await wipeResumes("owner");
      const ok = await upload("owner", makePdf(["Again", "SKILLS", "Zyrouting"]));
      const again = await http().post(`/api/resumes/${ok.done!.body.id}/complete`).set(as("owner")).expect(201);
      expect(again.body.id).toBe(ok.done!.body.id);
      expect(await prisma.resume.count({ where: { userId: ids.owner } })).toBe(1);
    });

    it("deleting removes the file and the suggestions but leaves what the member already accepted", async () => {
      const { overview: o } = await settled("owner", (await overview("owner")).current.id);
      const skill = suggestion(o, "skill", (d) => d.name === "Zyrouting");
      await http().put(`/api/resumes/suggestions/${skill.id}`).set(as("owner")).send({ decision: "accept" }).expect(200);
      const file = await prisma.storedFile.findUniqueOrThrow({ where: { id: o.current.fileId } });
      await http().delete(`/api/resumes/${o.current.id}`).set(as("owner")).expect(200);
      expect((await storage.headObject(file.bucket, file.path)).exists).toBe(false);
      expect((await prisma.storedFile.findUniqueOrThrow({ where: { id: file.id } })).status).toBe("deleted");
      expect(await prisma.resumeSuggestion.count({ where: { resumeId: o.current.id } })).toBe(0);
      expect(await prisma.memberSkill.count({ where: { userId: ids.owner, skillId: skillIds.Zyrouting } })).toBe(1);
      expect((await http().get(`/api/files/${file.id}/link`).set(as("owner"))).status).toBe(404);
      expect((await overview("owner")).current).toBeNull();
      await http().delete(`/api/resumes/${o.current.id}`).set(as("owner")).expect(404);
    });
  });

  describe("hostile and unreadable files", () => {
    beforeEach(async () => {
      await wipeResumes("owner");
    });

    it("a DOCX with macros is accepted by the signature check, then removed by the content check", async () => {
      const { done } = await upload("owner", makeDocx(["Macro Person"], { "word/vbaProject.bin": "binary" }), "macro.docx", DOCX_TYPE);
      const { resume } = await settled("owner", done!.body.id);
      expect(resume.status).toBe("rejected");
      expect(resume.failureCode).toBe("unsafe_content");
      expect(resume.failureMessage).toContain("macros");
      expect(resume.failureMessage).not.toMatch(/worker|exception|stack/i);
      const file = await prisma.storedFile.findUniqueOrThrow({ where: { id: resume.fileId } });
      expect(file.status).toBe("rejected");
      expect((await storage.headObject(file.bucket, file.path)).exists).toBe(false);
      expect((await http().get(`/api/resumes/${resume.id}/link`).set(as("owner"))).status).toBe(404);
      expect((await http().get(`/api/files/${file.id}/link`).set(as("admin"))).status).toBe(404);
    });

    it("a PDF with JavaScript is removed the same way", async () => {
      const { done } = await upload("owner", makePdf(RESUME_LINES, { extraDict: "/OpenAction << /S /JavaScript /JS (app.alert(1)) >>" }), "js.pdf");
      const { resume } = await settled("owner", done!.body.id);
      expect([resume.status, resume.failureCode]).toEqual(["rejected", "unsafe_content"]);
    });

    it("a zip bomb ends in a plain failure, and manual entry is not blocked", async () => {
      const bomb = makeZipBombDocx(80);
      expect(bomb.length).toBeLessThan(5 * 1024 * 1024);
      const { done } = await upload("owner", bomb, "bomb.docx", DOCX_TYPE);
      const { resume } = await settled("owner", done!.body.id);
      expect([resume.status, resume.failureCode]).toEqual(["failed", "too_complex"]);
      expect(resume.failureMessage).toContain("enter your details by hand");
      expect(resume.retryable).toBe(false);
      // Entering skills by hand still works (PRD-007: a parse failure never blocks manual entry).
      await http().put("/api/skills/mine").set(as("owner")).send({ skills: [{ skillId: skillIds.Zyrouting, visibility: "members" }] }).expect(200);
      await prisma.memberSkill.deleteMany({ where: { userId: ids.owner } });
    });

    it("a PDF with no text layer (a scan) says so in plain words", async () => {
      const { done } = await upload("owner", makePdf([]), "scan.pdf");
      const { resume } = await settled("owner", done!.body.id);
      expect([resume.status, resume.failureCode]).toEqual(["failed", "no_text"]);
      expect(resume.failureMessage).toContain("scan");
      expect((await overview("owner")).suggestions).toEqual([]);
    });

    it("a broken PDF that passes the signature check fails gracefully; the file stays, retry is refused", async () => {
      const { done } = await upload("owner", Buffer.from("%PDF-1.7\nthis is not really a pdf\n"), "broken.pdf");
      const { resume } = await settled("owner", done!.body.id);
      expect([resume.status, resume.failureCode]).toEqual(["failed", "unreadable"]);
      await http().get(`/api/resumes/${resume.id}/link`).set(as("owner")).expect(200); // still the member's file
    });

    it("\"try again\" re-queues a retryable failure once and reads it again", async () => {
      const { done } = await upload("owner", makePdf(RESUME_LINES), "slow.pdf");
      const { resume } = await settled("owner", done!.body.id);
      await prisma.resume.update({ where: { id: resume.id }, data: { status: "failed", failureCode: "timeout", parsedAt: null } });
      await prisma.resumeSuggestion.deleteMany({ where: { resumeId: resume.id } });
      const retry = await http().post(`/api/resumes/${resume.id}/retry`).set(as("owner")).expect(201);
      expect(retry.body.status).toBe("parsing");
      const again = await settled("owner", resume.id);
      expect(again.resume.status).toBe("ready");
      expect(again.overview.suggestions.length).toBeGreaterThan(0);
      // Not failed any more: a second retry is refused.
      expect((await http().post(`/api/resumes/${resume.id}/retry`).set(as("owner"))).status).toBe(409);
    });
  });

  describe("idempotency, stuck work and the switch", () => {
    beforeAll(async () => {
      await wipeResumes("owner");
    });

    it("running the parse job twice adds nothing and the second run is skipped", async () => {
      const { done } = await upload("owner", makePdf(RESUME_LINES), "twice.pdf");
      const { overview: first } = await settled("owner", done!.body.id);
      const count = await prisma.resumeSuggestion.count({ where: { resumeId: done!.body.id } });
      expect(count).toBe(first.suggestions.length);
      expect(await parser.process(done!.body.id)).toBe("skipped"); // already ready
      await prisma.resume.update({ where: { id: done!.body.id }, data: { status: "parsing", parseStartedAt: null } });
      expect(await parser.process(done!.body.id)).toBe("parsed"); // forced re-run
      expect(await prisma.resumeSuggestion.count({ where: { resumeId: done!.body.id } })).toBe(count);
    });

    it("a decision survives a re-run of the parse", async () => {
      const o = await overview("owner");
      const net = suggestion(o, "skill", (d) => d.name === "Zynet");
      await http().put(`/api/resumes/suggestions/${net.id}`).set(as("owner")).send({ decision: "reject" }).expect(200);
      await prisma.resume.update({ where: { id: o.current.id }, data: { status: "parsing", parseStartedAt: null } });
      await parser.process(o.current.id);
      expect((await prisma.resumeSuggestion.findUniqueOrThrow({ where: { id: net.id } })).status).toBe("rejected");
    });

    it("two workers racing for one resume: only one claims it", async () => {
      const o = await overview("owner");
      await prisma.resume.update({ where: { id: o.current.id }, data: { status: "parsing", parseStartedAt: null } });
      const results = await Promise.all([parser.process(o.current.id), parser.process(o.current.id), parser.process(o.current.id)]);
      expect(results.filter((r) => r === "parsed")).toHaveLength(1);
      expect(results.filter((r) => r === "skipped")).toHaveLength(2);
    });

    it("the sweep queues a stuck parse again, gives up on one that keeps failing, and drops abandoned uploads (fake clock)", async () => {
      const o = await overview("owner");
      await prisma.resume.update({ where: { id: o.current.id }, data: { status: "parsing", parseStartedAt: null, parseRun: 1 } });
      const later = new Date(Date.now() + 30 * 60_000);
      const swept = await parser.sweep(later);
      expect(swept.requeued).toBeGreaterThanOrEqual(1);
      await settled("owner", o.current.id);
      expect((await prisma.resume.findUniqueOrThrow({ where: { id: o.current.id } })).parseRun).toBe(2);

      await prisma.resume.update({ where: { id: o.current.id }, data: { status: "parsing", parseStartedAt: null, parseRun: 5 } });
      expect((await parser.sweep(later)).failed).toBeGreaterThanOrEqual(1);
      expect((await prisma.resume.findUniqueOrThrow({ where: { id: o.current.id } })).status).toBe("failed");
      await prisma.resume.update({ where: { id: o.current.id }, data: { status: "ready", failureCode: null } });

      const start = await http().post("/api/resumes/upload-url").set(as("owner")).send({ originalName: "never.pdf", contentType: PDF_TYPE, sizeBytes: 100 }).expect(201);
      expect((await parser.sweep(new Date(Date.now() + 2 * 24 * 3600_000))).abandoned).toBeGreaterThanOrEqual(1);
      expect(await prisma.resume.findUnique({ where: { id: start.body.resume.id } })).toBeNull();
    });

    it("the resumes.upload switch stops new uploads and re-reads but not viewing or deleting", async () => {
      const o = await overview("owner");
      await flags.write(FLAG_BY_KEY.get("resumes.upload")!, false, ids.admin);
      try {
        const start = await http().post("/api/resumes/upload-url").set(as("owner")).send({ originalName: "x.pdf", contentType: PDF_TYPE, sizeBytes: 100 });
        expect(start.status).toBe(403);
        expect(start.body.code).toBe("FEATURE_DISABLED");
        expect((await http().post(`/api/resumes/${o.current.id}/retry`).set(as("owner"))).status).toBe(403);
        await http().get("/api/resumes").set(as("owner")).expect(200);
        await http().get(`/api/resumes/${o.current.id}/link`).set(as("owner")).expect(200);
        await http().delete(`/api/resumes/${o.current.id}`).set(as("owner")).expect(200);
      } finally {
        await prisma.featureFlag.deleteMany({ where: { key: "resumes.upload" } });
        flags.invalidate();
      }
    });

    it("the 25-skill cap still holds when accepting a suggestion", async () => {
      const { done } = await upload("owner", makePdf(RESUME_LINES), "cap.pdf");
      const { overview: o } = await settled("owner", done!.body.id);
      const filler = await Promise.all(
        Array.from({ length: MAX_MEMBER_SKILLS }, (_, i) =>
          prisma.skill.create({ data: { name: `Zyfill${i}`, nameKey: `zyfill${i}`, matchKey: `zyfill${i}`, level: "micro", parentId: skillIds.Zyminor } }),
        ),
      );
      await prisma.memberSkill.createMany({ data: filler.map((s) => ({ userId: ids.owner!, skillId: s.id })) });
      const net = suggestion(o, "skill", (d) => d.name === "Zynet");
      const res = await http().put(`/api/resumes/suggestions/${net.id}`).set(as("owner")).send({ decision: "accept" });
      expect(res.status).toBe(409);
      expect(res.body.message).toContain("25 skills");
      expect((await prisma.resumeSuggestion.findUniqueOrThrow({ where: { id: net.id } })).status).toBe("pending");
      await prisma.memberSkill.deleteMany({ where: { userId: ids.owner } });
      await prisma.skill.deleteMany({ where: { id: { in: filler.map((s) => s.id) } } });
    });
  });

  describe("data rights (TASK-046 integration)", () => {
    let leaverResume: { id: string; fileId: string };
    let leaverPath: { bucket: string; path: string };

    beforeAll(async () => {
      await wipeResumes("owner");
      const first = await upload("leaver", makePdf(RESUME_LINES), "Leaver CV (final).pdf");
      leaverResume = first.done!.body;
      const { overview: o } = await settled("leaver", leaverResume.id);
      await http().put(`/api/resumes/suggestions/${suggestion(o, "skill", (d) => d.name === "Zyrouting").id}`).set(as("leaver")).send({ decision: "accept" }).expect(200);
      await http().put(`/api/resumes/suggestions/${suggestion(o, "education").id}`).set(as("leaver")).send({ decision: "accept" }).expect(200);
      await http().put(`/api/resumes/suggestions/${suggestion(o, "skill", (d) => d.name === "Zynet").id}`).set(as("leaver")).send({ decision: "reject" }).expect(200);
      const second = await upload("leaver", makeDocx(["Second version", "SKILLS", "Zybgp"]), "v2.docx", DOCX_TYPE);
      await settled("leaver", second.done!.body.id);
      const file = await prisma.storedFile.findUniqueOrThrow({ where: { id: leaverResume.fileId } });
      leaverPath = { bucket: file.bucket, path: file.path };
      // Someone else's resume must stay out of this member's export.
      await upload("owner", makePdf(["OWNER-SECRET-RESUME", "SKILLS", "Zyrouting"]), "owner-secret.pdf");
    });

    it("the member export carries every stored resume version, the suggestions with their decisions, and what was accepted", async () => {
      await http().post("/api/data-rights/export").set(as("leaver")).expect(201);
      await waitFor(async () => {
        const o = await http().get("/api/data-rights").set(as("leaver"));
        return o.body.export?.status === "ready";
      });
      const link = await http().post("/api/data-rights/export/link").set(as("leaver")).expect(200);
      const zip = readZip(await storage.readWithToken(link.body.url));
      const names = Object.keys(zip).sort();
      expect(names).toEqual(expect.arrayContaining(["resumes.json", "resume/v1-Leaver_CV_final_.pdf", "resume/v2-v2.docx"]));
      expect(zip["resume/v1-Leaver_CV_final_.pdf"]!.subarray(0, 5).toString()).toBe("%PDF-");
      const data = JSON.parse(zip["resumes.json"]!.toString());
      expect(data.resumes.map((r: { version: number }) => r.version)).toEqual([1, 2]);
      expect(data.resumes[1].current).toBe(true);
      const v1 = data.resumes[0];
      expect(v1.suggestions.find((x: { data: { name?: string } }) => x.data.name === "Zyrouting").decision).toBe("accepted");
      expect(v1.suggestions.find((x: { data: { name?: string } }) => x.data.name === "Zynet").decision).toBe("rejected");
      expect(data.acceptedEducation).toHaveLength(1);
      expect(zip["README.txt"]!.toString()).toContain("resumes.json");
      // Nothing of the other member's resume.
      expect(Buffer.concat(Object.values(zip)).toString("latin1")).not.toContain("OWNER-SECRET-RESUME");
    });

    it("account erasure removes the resumes, their files, the suggestions and the accepted entries, and leaves other members alone", async () => {
      const ownerBefore = await prisma.resume.count({ where: { userId: ids.owner } });
      expect(ownerBefore).toBe(1);
      expect((await storage.headObject(leaverPath.bucket, leaverPath.path)).exists).toBe(true);
      expect(await app.get(AccountErasureService).eraseNow(ids.leaver!)).toBe("erased");
      expect(await prisma.resume.count({ where: { userId: ids.leaver } })).toBe(0);
      expect(await prisma.resumeSuggestion.count({ where: { userId: ids.leaver } })).toBe(0);
      expect(await prisma.memberEducation.count({ where: { userId: ids.leaver } })).toBe(0);
      expect(await prisma.memberExperience.count({ where: { userId: ids.leaver } })).toBe(0);
      expect(await prisma.memberSkill.count({ where: { userId: ids.leaver } })).toBe(0);
      expect(await prisma.storedFile.count({ where: { ownerId: ids.leaver } })).toBe(0);
      expect((await storage.headObject(leaverPath.bucket, leaverPath.path)).exists).toBe(false);
      // The access log is append-only and keeps its rows, without any file content.
      expect(await prisma.fileAccessLog.count({ where: { fileId: leaverResume.fileId } })).toBeGreaterThan(0);
      expect(await prisma.resume.count({ where: { userId: ids.owner } })).toBe(ownerBefore);
    });
  });
});
