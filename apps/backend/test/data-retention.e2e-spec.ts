import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import { DAY_MS, RETENTION_RULES, retentionDays } from "@packetpulse/types";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { RetentionService } from "../src/modules/data-rights/application/retention.service";
import { DataRightsProcessor } from "../src/modules/data-rights/infrastructure/data-rights.processor";

// TEST-041 (TASK-046): the retention schedule as code, run against a fake clock. Rows are made
// "old" by moving `now` forward, never by sleeping. The audit log, file access log and reputation
// ledger are append-only and must come out of every run untouched.
jest.setTimeout(60_000);

const PREFIX = "drt-";

describe("Retention schedule (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let retention: RetentionService;
  let userId: string;
  let erasedLongAgoId: string;
  let erasedRecentlyId: string;
  const marker = `drt-${randomUUID()}`;

  const at = (days: number, from = new Date()) => new Date(from.getTime() + days * DAY_MS);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    retention = app.get(RetentionService);
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
    const mk = (name: string, over: object = {}) =>
      prisma.user.create({ data: { firstName: "R", lastName: name, email: `${PREFIX}${name}@example.com`, ...over } }).then((u) => u.id);
    userId = await mk("live");
    erasedLongAgoId = await mk("erased-old", { erasedAt: new Date(Date.now() - 4 * 365 * DAY_MS) });
    erasedRecentlyId = await mk("erased-new", { erasedAt: new Date(Date.now() - 30 * DAY_MS) });
  });

  afterAll(async () => {
    await prisma.clientLog.deleteMany({ where: { message: marker } });
    await prisma.dataRequest.deleteMany({ where: { userId: { in: [userId, erasedLongAgoId, erasedRecentlyId] } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await app.close();
  });

  it("every automated rule names a period and every manual one does not", () => {
    for (const r of RETENTION_RULES) expect(r.automated).toBe(r.days !== null);
    expect(retentionDays("notifications")).toBe(365);
    expect(retentionDays("consent_after_erasure")).toBe(3 * 365);
    expect(RETENTION_RULES.find((r) => r.key === "audit_log")).toMatchObject({ automated: false, days: null });
  });

  it("deletes what has aged out and keeps what has not, per rule (fake clock)", async () => {
    const now = new Date();
    const sessionDays = retentionDays("refresh_tokens");
    const mkToken = (over: object) =>
      prisma.refreshToken.create({ data: { userId, tokenHash: `h-${randomUUID()}`, familyId: randomUUID(), expiresAt: at(7), ...over } });
    const oldExpired = await mkToken({ expiresAt: at(-1) });
    const oldRevoked = await mkToken({ revokedAt: at(-1) });
    const active = await mkToken({});

    const oldReset = await prisma.passwordReset.create({ data: { userId, otpHash: "x", expiresAt: at(-1) } });
    const liveReset = await prisma.passwordReset.create({ data: { userId, otpHash: "x", expiresAt: at(30) } });

    const oldNote = await prisma.notification.create({ data: { userId, type: "forum_reply", payload: {}, createdAt: at(-1) } });
    const newNote = await prisma.notification.create({ data: { userId, type: "forum_reply", payload: {}, createdAt: at(400) } });
    await prisma.notificationDelivery.create({ data: { userId, notificationId: oldNote.id, eventType: "forum_reply", channel: "in_app", status: "delivered", createdAt: at(-1) } });
    const keptDelivery = await prisma.notificationDelivery.create({ data: { userId, notificationId: newNote.id, eventType: "forum_reply", channel: "in_app", status: "delivered", createdAt: at(400) } });

    const oldLog = await prisma.clientLog.create({ data: { level: "error", message: marker, createdAt: at(-1) } });
    const newLog = await prisma.clientLog.create({ data: { level: "error", message: marker, createdAt: at(400) } });

    const policy = await prisma.consentPolicy.findFirstOrThrow({ where: { purpose: "privacy" } });
    const consent = (uid: string) => prisma.consentRecord.create({ data: { userId: uid, purpose: "privacy", action: "granted", policyVersion: policy.version, source: "registration" } });
    const cOld = await consent(erasedLongAgoId);
    const cNew = await consent(erasedRecentlyId);
    const cLive = await consent(userId);

    const doneOld = await prisma.dataRequest.create({ data: { userId, kind: "export", status: "expired", requestedAt: at(-1) } });
    const openOld = await prisma.dataRequest.create({ data: { userId, kind: "export", status: "requested", activeSlot: "open" } });
    await prisma.$executeRaw`UPDATE data_requests SET updated_at = ${at(-1)} WHERE id = ${doneOld.id}`;

    const auditBefore = await prisma.adminActivityLog.count();
    const accessBefore = await prisma.fileAccessLog.count();

    // One day before the cutoff nothing of ours is old enough...
    const early = at(sessionDays - 2, now);
    await retention.run(early); // (the shared test database may hold older rows from other suites; only ours are asserted)
    expect(await prisma.refreshToken.count({ where: { id: { in: [oldExpired.id, oldRevoked.id] } } })).toBe(2);

    // ...and 400 days on, everything past its period goes.
    const later = at(400, now);
    const counts = await retention.run(later);
    expect(counts.refresh_tokens).toBeGreaterThanOrEqual(2);
    // The sessions that expired or were revoked a day ago are 400 days old by then; the active one expired 7 days from the start, also gone.
    expect(await prisma.refreshToken.count({ where: { id: { in: [oldExpired.id, oldRevoked.id, active.id] } } })).toBe(0);
    expect(await prisma.passwordReset.count({ where: { id: { in: [oldReset.id, liveReset.id] } } })).toBe(0); // both expire before day 400
    expect(await prisma.notification.count({ where: { id: oldNote.id } })).toBe(0);
    expect(await prisma.notificationDelivery.count({ where: { id: keptDelivery.id } })).toBe(1);
    expect(await prisma.clientLog.count({ where: { id: oldLog.id } })).toBe(0);
    expect(await prisma.clientLog.count({ where: { id: newLog.id } })).toBe(1);
    expect(await prisma.consentRecord.count({ where: { id: cOld.id } })).toBe(0);
    expect(await prisma.consentRecord.count({ where: { id: { in: [cNew.id, cLive.id] } } })).toBe(2);
    expect(await prisma.dataRequest.count({ where: { id: doneOld.id } })).toBe(1); // finished 400 days ago < 3 years
    expect(await prisma.dataRequest.count({ where: { id: openOld.id } })).toBe(1); // open requests are never retention-deleted

    // Past three years: finished requests go, open ones still stay.
    const muchLater = at(3 * 365 + 10, now);
    const c2 = await retention.run(muchLater);
    expect(c2.data_requests).toBeGreaterThanOrEqual(1);
    expect(await prisma.dataRequest.count({ where: { id: doneOld.id } })).toBe(0);
    expect(await prisma.dataRequest.count({ where: { id: openOld.id } })).toBe(1);
    expect(await prisma.consentRecord.count({ where: { id: cNew.id } })).toBe(0); // erased 30 days ago + 3 years has passed too
    expect(await prisma.consentRecord.count({ where: { id: cLive.id } })).toBe(1); // a live account's consent is never aged out

    // Append-only logs only grew (by the run records).
    expect(await prisma.fileAccessLog.count()).toBe(accessBefore);
    expect(await prisma.adminActivityLog.count()).toBeGreaterThanOrEqual(auditBefore + 1);
    expect(await prisma.adminActivityLog.count({ where: { action: "retention_cleanup_run" } })).toBeGreaterThanOrEqual(1);
    void newNote;
  });

  it("a run with nothing to delete writes no audit row", async () => {
    const before = await prisma.adminActivityLog.count({ where: { action: "retention_cleanup_run" } });
    const counts = await retention.run(new Date());
    expect(Object.values(counts).every((n) => n === 0)).toBe(true);
    expect(await prisma.adminActivityLog.count({ where: { action: "retention_cleanup_run" } })).toBe(before);
  });

  it("the sweep runs due erasures, expired exports and retention together (fake clock)", async () => {
    const processor = app.get(DataRightsProcessor);
    const result = await processor.sweep(new Date());
    expect(result).toEqual(expect.objectContaining({ erasures: expect.any(Number), expired: expect.any(Number), requeued: expect.any(Number), retention: expect.any(Object) }));
  });
});
