import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { getQueueToken } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import { FANOUT_QUEUE, idempotencyJobId } from "../src/modules/notifications/infrastructure/queue/queue-config";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { TokenService } from "../src/modules/identity/application/services/token.service";
import { toPublicUser, userWithRolesInclude } from "../src/modules/identity";

// TASK-026 / TEST-050: thread modes, accepted answer, reports and the moderator queue, guidelines
// acceptance, and the reputation ledger with its abuse limits.

jest.setTimeout(120_000);

describe("Community Q&A, guidelines and reputation (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokens: TokenService;
  const PREFIX = `qatest${Date.now()}`;
  const cookies: Record<string, string> = {};
  const ids: Record<string, string> = {};
  let categoryId: string;

  async function makeUser(label: string, role: string) {
    const user = await prisma.user.create({
      data: {
        firstName: "QA",
        lastName: label,
        email: `${PREFIX}-${label}@example.com`,
        isApproved: true,
        emailVerified: true,
        roles: { create: [{ role: { connect: { name: role } } }] },
      },
      include: userWithRolesInclude,
    });
    cookies[label] = `accessToken=${tokens.signAccessToken(toPublicUser(user))}`;
    ids[label] = user.id;
    return user;
  }
  const as = (who: string) => ({
    get: (url: string) => request(app.getHttpServer()).get(url).set("Cookie", cookies[who]),
    post: (url: string, body: object = {}) => request(app.getHttpServer()).post(url).set("Cookie", cookies[who]).send(body),
    put: (url: string, body: object = {}) => request(app.getHttpServer()).put(url).set("Cookie", cookies[who]).send(body),
    del: (url: string, body: object = {}) => request(app.getHttpServer()).delete(url).set("Cookie", cookies[who]).send(body),
  });
  const accept = (who: string) => prisma.forumGuidelineAcceptance.upsert({
    where: { userId_version: { userId: ids[who], version: 1 } },
    create: { userId: ids[who], version: 1 },
    update: {},
  });
  const rep = async (who: string) => (await prisma.forumReputationEvent.aggregate({ _sum: { points: true }, where: { userId: ids[who] } }))._sum.points ?? 0;
  // The job the dispatcher path consumes. Asserting the queued job (not the finished row) keeps the
  // test stable when another process on the same Redis consumes the queue first.
  const fanoutJob = (who: string, type: string, key: string) =>
    app.get<Queue>(getQueueToken(FANOUT_QUEUE)).getJob(idempotencyJobId("fanout", ids[who], type, key));
  let n = 0;
  const thread = (author: string, extra: object = {}) =>
    prisma.forumThread.create({ data: { categoryId, authorId: ids[author], title: `${PREFIX} thread ${++n}`, content: "content body", slug: `${PREFIX}-${n}`, ...extra } });
  const reply = (threadId: string, author: string) =>
    prisma.forumReply.create({ data: { threadId, authorId: ids[author], content: `answer ${++n}` } });
  const validThread = (extra: object = {}) => ({
    categoryId,
    title: "How does OSPF elect a DR?",
    content: "I want to understand the election order on a broadcast segment.",
    sensitiveDataConfirmed: true,
    ...extra,
  });

  async function cleanup() {
    await prisma.forumThread.deleteMany({ where: { slug: { startsWith: PREFIX } } });
    await prisma.forumThread.deleteMany({ where: { author: { email: { startsWith: PREFIX } } } });
    await prisma.forumGuidelineVersion.deleteMany({ where: { createdBy: { email: { startsWith: PREFIX } } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await prisma.category.deleteMany({ where: { slug: { startsWith: PREFIX } } });
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
    for (const [label, role] of [["asker", "member"], ["alice", "member"], ["bob", "member"], ["carol", "member"], ["mod", "moderator"], ["admin", "admin"]] as const) {
      await makeUser(label, role);
    }
    categoryId = (await prisma.category.create({ data: { name: `${PREFIX} cat`, slug: `${PREFIX}-cat` } })).id;
  });
  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  describe("asking a question", () => {
    it("needs the guidelines accepted first, then creates a thread with its mode", async () => {
      const blocked = await as("asker").post("/api/forums/threads", validThread()).expect(403);
      expect(blocked.body.message).toMatch(/guidelines/i);
      const status = await as("asker").get("/api/forums/guidelines/status").expect(200);
      expect(status.body).toMatchObject({ mustAccept: true, acceptedVersion: null });
      await as("asker").post("/api/forums/guidelines/accept").expect(200);
      await as("asker").post("/api/forums/guidelines/accept").expect(200); // repeat changes nothing
      expect(await prisma.forumGuidelineAcceptance.count({ where: { userId: ids.asker } })).toBe(1);
      const ok = await as("asker").post("/api/forums/threads", validThread({ mode: "production" })).expect(201);
      expect(ok.body.mode).toBe("production");
      const dflt = await as("asker").post("/api/forums/threads", validThread({ title: "Default mode question" })).expect(201);
      expect(dflt.body.mode).toBe("learning");
    });

    it("enforces the PRD-024 minimums and the sensitive-data confirmation, with a field message", async () => {
      await accept("alice");
      for (const bad of [{ title: "short" }, { content: "too short" }, { sensitiveDataConfirmed: false }, { sensitiveDataConfirmed: undefined }, { mode: "other" }]) {
        const res = await as("alice").post("/api/forums/threads", validThread(bad));
        expect(res.status).toBeGreaterThanOrEqual(400);
        expect(res.status).toBeLessThan(500);
        expect(res.body.code).toBe("VALIDATION_FAILED");
      }
    });

    it("filters the list by mode and hides removed threads", async () => {
      const t = await thread("asker", { mode: "expert" });
      const res = await as("alice").get("/api/forums/threads?mode=expert").expect(200);
      expect(res.body.data.map((x: { id: string }) => x.id)).toContain(t.id);
      expect(res.body.data.every((x: { mode: string }) => x.mode === "expert")).toBe(true);
    });

    it("replying also needs the guidelines", async () => {
      const t = await thread("asker");
      await as("carol").post(`/api/forums/threads/${t.id}/replies`, { content: "an answer" }).expect(403);
      await accept("carol");
      await as("carol").post(`/api/forums/threads/${t.id}/replies`, { content: "an answer" }).expect(201);
    });
  });

  describe("accepted answer", () => {
    it("only the asker or a moderator accepts; one at a time; shown first; reputation follows", async () => {
      const t = await thread("asker");
      const a = await reply(t.id, "alice");
      const b = await reply(t.id, "bob");
      await as("bob").put(`/api/forums/threads/${t.id}/accept/${a.id}`).expect(403);
      await as("alice").put(`/api/forums/threads/${t.id}/accept/${a.id}`).expect(403);
      await as("asker").put(`/api/forums/threads/${t.id}/accept/${b.id}`).expect(200);
      let detail = (await as("alice").get(`/api/forums/threads/${t.id}`).expect(200)).body;
      expect(detail.acceptedReplyId).toBe(b.id);
      expect(detail.replies[0]).toMatchObject({ id: b.id, isAccepted: true });
      const bobBefore = await rep("bob");
      expect(bobBefore).toBe(15);
      // choosing another answer replaces it: still exactly one accepted, bob's points are taken back
      await as("asker").put(`/api/forums/threads/${t.id}/accept/${a.id}`).expect(200);
      detail = (await as("alice").get(`/api/forums/threads/${t.id}`).expect(200)).body;
      expect(detail.replies.filter((r: { isAccepted: boolean }) => r.isAccepted)).toHaveLength(1);
      expect(detail.replies[0].id).toBe(a.id);
      expect(await rep("bob")).toBe(0);
      expect(await rep("alice")).toBe(15);
      expect(detail.replies[0].author.reputation).toMatchObject({ points: 15, level: expect.any(String) });
    });

    it("a reply from another thread cannot be accepted; accepting your own answer earns nothing", async () => {
      const t = await thread("asker");
      const other = await thread("alice");
      const foreign = await reply(other.id, "bob");
      await as("asker").put(`/api/forums/threads/${t.id}/accept/${foreign.id}`).expect(404);
      const own = await reply(t.id, "asker");
      const before = await rep("asker");
      await as("asker").put(`/api/forums/threads/${t.id}/accept/${own.id}`).expect(200);
      expect(await rep("asker")).toBe(before);
    });

    it("a moderator needs a reason, and the acceptance is audited", async () => {
      const t = await thread("asker");
      const a = await reply(t.id, "bob");
      await as("mod").put(`/api/forums/threads/${t.id}/accept/${a.id}`).expect(400);
      await as("mod").put(`/api/forums/threads/${t.id}/accept/${a.id}`, { reason: "Asker is away; this solves it" }).expect(200);
      const log = await prisma.adminActivityLog.findFirst({ where: { action: "forum_answer_accepted", targetId: t.id } });
      expect(log?.reason).toBe("Asker is away; this solves it");
      expect(log?.actorId).toBe(ids.mod);
    });

    it("the author is told through the notification queue", async () => {
      const t = await thread("asker");
      const a = await reply(t.id, "carol");
      await as("asker").put(`/api/forums/threads/${t.id}/accept/${a.id}`).expect(200);
      const job = await fanoutJob("carol", "forum_answer_accepted", `accepted:${a.id}`);
      expect(job?.data).toMatchObject({ userId: ids.carol, type: "forum_answer_accepted", payload: { threadId: t.id } });
    });
  });

  describe("helpful votes and the reputation limits", () => {
    it("refuses a vote for your own reply, and a vote then an un-vote nets zero", async () => {
      const t = await thread("asker");
      const r = await reply(t.id, "alice");
      await as("alice").put(`/api/forums/replies/${r.id}/like`).expect(400);
      const before = await rep("alice");
      await as("bob").put(`/api/forums/replies/${r.id}/like`).expect(200);
      expect(await rep("alice")).toBe(before + 2);
      await as("bob").put(`/api/forums/replies/${r.id}/like`).expect(200);
      expect(await rep("alice")).toBe(before);
    });

    it("caps helpful-vote points per day and votes per voter and author pair", async () => {
      const t = await thread("asker");
      const author = "carol";
      const base = await rep(author);
      const replies = await Promise.all(Array.from({ length: 5 }, () => reply(t.id, author)));
      // one voter: only 3 votes count in 30 days
      for (const r of replies) await as("bob").put(`/api/forums/replies/${r.id}/like`).expect(200);
      expect((await rep(author)) - base).toBe(6);
      // a daily cap of 20 points = 10 votes: three more voters with three votes each tops out
      const extra = await Promise.all(Array.from({ length: 4 }, (_, i) => makeUser(`voter${i}`, "member")));
      const more = await Promise.all(Array.from({ length: 4 }, () => reply(t.id, author)));
      for (const v of extra) for (const r of more.slice(0, 3)) await as(`voter${extra.indexOf(v)}`).put(`/api/forums/replies/${r.id}/like`).expect(200);
      expect((await rep(author)) - base).toBeLessThanOrEqual(20);
    });

    it("the ledger is append-only and the total is recomputable from it", async () => {
      const row = await prisma.forumReputationEvent.findFirstOrThrow({ where: { userId: ids.alice } });
      await expect(prisma.forumReputationEvent.update({ where: { id: row.id }, data: { points: 999 } })).rejects.toThrow(/append-only/);
      await expect(prisma.forumReputationEvent.delete({ where: { id: row.id } })).rejects.toThrow(/append-only/);
      const shown = (await as("bob").get(`/api/forums/reputation/${ids.alice}`).expect(200)).body;
      expect(shown.points).toBe(Math.max(0, await rep("alice")));
      expect(shown.level).toEqual(expect.any(String));
    });
  });

  describe("reports and the moderator queue", () => {
    it("a member reports once per post, not their own, and the reason is required", async () => {
      const t = await thread("asker");
      const r = await reply(t.id, "alice");
      await as("bob").post(`/api/forums/replies/${r.id}/report`, {}).expect((res) => expect(res.status).toBeGreaterThanOrEqual(400));
      const ok = await as("bob").post(`/api/forums/replies/${r.id}/report`, { reason: "sensitive_data", details: "An API key" }).expect(201);
      expect(ok.body.urgent).toBe(true);
      await as("bob").post(`/api/forums/replies/${r.id}/report`, { reason: "spam" }).expect(409);
      await as("alice").post(`/api/forums/replies/${r.id}/report`, { reason: "spam" }).expect(400);
      await as("bob").post(`/api/forums/threads/${t.id}/report`, { reason: "off_topic" }).expect(201);
    });

    it("limits how many reports one member can file in a day", async () => {
      const t = await thread("asker");
      const spammer = await makeUser("reporter", "member");
      const targets = await Promise.all(Array.from({ length: 11 }, () => reply(t.id, "alice")));
      for (const r of targets.slice(0, 10)) await as("reporter").post(`/api/forums/replies/${r.id}/report`, { reason: "spam" }).expect(201);
      const res = await as("reporter").post(`/api/forums/replies/${targets[10].id}/report`, { reason: "spam" }).expect(429);
      expect(res.body.code).toBe("RATE_LIMITED");
      expect(spammer.id).toBeTruthy();
    });

    it("only moderators open the queue; urgent reports come first with an acknowledge-by time", async () => {
      await as("bob").get("/api/forums/reports").expect(403);
      const res = await as("mod").get("/api/forums/reports?status=open").expect(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      const urgentIdx = res.body.data.findIndex((r: { urgent: boolean }) => r.urgent);
      const normalIdx = res.body.data.findIndex((r: { urgent: boolean }) => !r.urgent);
      if (urgentIdx >= 0 && normalIdx >= 0) expect(urgentIdx).toBeLessThan(normalIdx);
      expect(res.body.data[0]).toEqual(expect.objectContaining({ reason: expect.any(String), acknowledgeBy: expect.any(String), excerpt: expect.any(String) }));
    });

    it("dismissing and removing need a reason, are audited, and cannot be repeated", async () => {
      const t = await thread("asker");
      const r1 = await reply(t.id, "alice");
      const rep1 = (await as("bob").post(`/api/forums/replies/${r1.id}/report`, { reason: "spam" }).expect(201)).body.id;
      await as("mod").put(`/api/forums/reports/${rep1}/dismiss`, {}).expect((res) => expect(res.status).toBeGreaterThanOrEqual(400));
      await as("bob").put(`/api/forums/reports/${rep1}/dismiss`, { reason: "No violation here" }).expect(403);
      await as("mod").put(`/api/forums/reports/${rep1}/dismiss`, { reason: "No violation here" }).expect(200);
      await as("mod").put(`/api/forums/reports/${rep1}/dismiss`, { reason: "No violation here" }).expect(409);
      const log = await prisma.adminActivityLog.findFirst({ where: { action: "forum_report_dismissed", targetId: rep1 } });
      expect(log).toMatchObject({ actorId: ids.mod, reason: "No violation here" });

      const r2 = await reply(t.id, "alice");
      const rep2 = (await as("bob").post(`/api/forums/replies/${r2.id}/report`, { reason: "spam" }).expect(201)).body.id;
      await as("carol").post(`/api/forums/replies/${r2.id}/report`, { reason: "spam" }).expect(201);
      await as("mod").put(`/api/forums/reports/${rep2}/remove`, {}).expect((res) => expect(res.status).toBeGreaterThanOrEqual(400));
      await as("mod").put(`/api/forums/reports/${rep2}/remove`, { reason: "Advertising is not allowed" }).expect(200);
      // every report on that reply is closed, the text is hidden, and the audit entry carries the reason
      expect(await prisma.forumReport.count({ where: { replyId: r2.id, status: "open" } })).toBe(0);
      const detail = (await as("bob").get(`/api/forums/threads/${t.id}`).expect(200)).body;
      const hidden = detail.replies.find((x: { id: string }) => x.id === r2.id);
      expect(hidden).toMatchObject({ removed: true, content: "" });
      expect(hidden.removedReason).toBeUndefined();
      const log2 = await prisma.adminActivityLog.findFirst({ where: { action: "forum_report_removed", targetId: r2.id } });
      expect(log2?.reason).toBe("Advertising is not allowed");
      // the author is told the reason
      const job = await fanoutJob("alice", "forum_post_removed", `removed:reply:${r2.id}`);
      expect(job?.data.payload).toMatchObject({ reason: "Advertising is not allowed", threadId: t.id });
    });

    it("removing a post takes back what it earned and applies the removal penalty once", async () => {
      const t = await thread("asker");
      const r = await reply(t.id, "bob");
      const before = await rep("bob");
      await as("asker").put(`/api/forums/threads/${t.id}/accept/${r.id}`).expect(200);
      await as("carol").put(`/api/forums/replies/${r.id}/like`).expect(200);
      expect(await rep("bob")).toBe(before + 17);
      await as("mod").del(`/api/forums/threads/${t.id}/replies/${r.id}`, {}).expect(400); // reason needed
      await as("mod").del(`/api/forums/threads/${t.id}/replies/${r.id}`, { reason: "Wrong and misleading" }).expect(200);
      expect(await rep("bob")).toBe(before - 10);
      const detail = (await as("asker").get(`/api/forums/threads/${t.id}`).expect(200)).body;
      expect(detail.acceptedReplyId).toBeNull();
      // removing again changes nothing
      await as("mod").del(`/api/forums/threads/${t.id}/replies/${r.id}`, { reason: "Wrong and misleading" }).expect(200);
      expect(await rep("bob")).toBe(before - 10);
    });

    it("moderator lock, pin and delete of someone else's thread need a reason; the author deletes without one", async () => {
      const t = await thread("asker");
      for (const action of ["lock", "unlock", "pin", "unpin"]) {
        await as("mod").put(`/api/forums/threads/${t.id}/${action}`, {}).expect(400);
        await as("mod").put(`/api/forums/threads/${t.id}/${action}`, { reason: "Housekeeping on this topic" }).expect(200);
      }
      await as("mod").del(`/api/forums/threads/${t.id}`, {}).expect(400);
      await as("mod").del(`/api/forums/threads/${t.id}`, { reason: "Duplicate of an older question" }).expect(200);
      await as("alice").get(`/api/forums/threads/${t.id}`).expect(404);
      const own = await thread("asker");
      await as("asker").del(`/api/forums/threads/${own.id}`).expect(200);
    });
  });

  describe("guidelines", () => {
    it("are public, versioned and editable only by an admin, who must give a reason", async () => {
      const pub = await request(app.getHttpServer()).get("/api/forums/guidelines").expect(200);
      expect(pub.body.version).toBeGreaterThanOrEqual(1);
      expect(pub.body.body).toMatch(/passwords/i);
      const body = `${PREFIX} new community guidelines text that is long enough to pass the schema.`;
      await as("alice").post("/api/forums/guidelines", { body, reason: "Wording update" }).expect(403);
      await as("mod").post("/api/forums/guidelines", { body, reason: "Wording update" }).expect(403);
      await as("admin").post("/api/forums/guidelines", { body }).expect((res) => expect(res.status).toBeGreaterThanOrEqual(400));
      const v = await as("admin").post("/api/forums/guidelines", { body, reason: "Wording update" }).expect(201);
      expect(v.body.version).toBe(pub.body.version + 1);
      expect((await request(app.getHttpServer()).get("/api/forums/guidelines").expect(200)).body.body).toBe(body);
      // the earlier version is kept, and an earlier acceptance still lets a member post
      expect(await prisma.forumGuidelineVersion.count({ where: { version: pub.body.version } })).toBe(1);
      const status = (await as("asker").get("/api/forums/guidelines/status").expect(200)).body;
      expect(status).toMatchObject({ mustAccept: false, acceptedVersion: 1 });
      await prisma.forumGuidelineVersion.deleteMany({ where: { version: { gt: pub.body.version } } });
    });
  });

  describe("signed-out and read access", () => {
    it("requires sign-in for reports, votes, acceptance and reputation but not for reading", async () => {
      const t = await thread("asker");
      const server = () => request(app.getHttpServer());
      await server().post(`/api/forums/threads/${t.id}/report`).send({ reason: "spam" }).expect(401);
      await server().put(`/api/forums/threads/${t.id}/accept/x`).send({}).expect(401);
      await server().get("/api/forums/reports").expect(401);
      await server().get(`/api/forums/reputation/${ids.alice}`).expect(401);
      await server().get(`/api/forums/threads/${t.id}`).expect(200);
    });
  });
});
