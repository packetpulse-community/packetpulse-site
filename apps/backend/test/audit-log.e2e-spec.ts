import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import * as bcrypt from "bcrypt";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { AdminActivityLogService } from "../src/modules/admin/application/services/admin-activity-log.service";

// TEST-008 (PRD-043 / SEC-08): every staff action writes who, what, subject, reason and time
// to an append-only log, and the database itself refuses to edit or delete entries.
// The log cannot be cleaned up by tests (that is the point), so every row is found by a
// per-run tag in its reason and the actors we create are the only things we delete.
describe("Audit log (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let activityLog: AdminActivityLogService;

  const PASSWORD = "Passw0rd!23";
  const TAG = `audit-${Date.now()}`;
  const reason = (what: string) => `${TAG} ${what} - needed for the test`;
  const EMAILS = {
    admin: "audit-admin@example.com",
    victim: "audit-victim@example.com",
    victim2: "audit-victim2@example.com",
    member: "audit-member@example.com",
    selfAdmin: "audit-selfadmin@example.com",
    doomed: "audit-doomed@example.com",
  };
  const allEmails = Object.values(EMAILS);

  let adminId: string;
  let victimId: string;
  let victim2Id: string;
  let admin: ReturnType<typeof request.agent>;
  let originalSettings: Record<string, unknown>;

  async function createUser(email: string, roleName: string) {
    const role = await prisma.role.findUniqueOrThrow({ where: { name: roleName } });
    return prisma.user.create({
      data: {
        firstName: "Audit",
        lastName: "Test",
        email,
        passwordHash: await bcrypt.hash(PASSWORD, 4),
        isApproved: true,
        emailVerified: true,
        roles: { create: { roleId: role.id } },
      },
    });
  }

  const entriesFor = (action: string) =>
    prisma.adminActivityLog.findMany({
      where: { action: action as never, reason: { contains: TAG } },
      orderBy: { createdAt: "asc" },
    });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix("api");
    await app.init();
    prisma = app.get(PrismaService);
    activityLog = app.get(AdminActivityLogService);

    await prisma.user.deleteMany({ where: { email: { in: allEmails } } });
    adminId = (await createUser(EMAILS.admin, "super_admin")).id;
    victimId = (await createUser(EMAILS.victim, "member")).id;
    victim2Id = (await createUser(EMAILS.victim2, "member")).id;
    admin = request.agent(app.getHttpServer());
    await admin.post("/api/auth/login").send({ email: EMAILS.admin, password: PASSWORD }).expect(200);
    const s = await admin.get("/api/admin/settings").expect(200);
    originalSettings = s.body;
  });

  afterAll(async () => {
    // Put the singleton settings back; the audit rows themselves are permanent by design.
    if (originalSettings) {
      const { id, updatedAt, createdAt, ...rest } = originalSettings as Record<string, unknown>;
      void id;
      void updatedAt;
      void createdAt;
      await prisma.siteSettings.update({ where: { id: "default" }, data: rest as never });
    }
    await prisma.user.deleteMany({ where: { email: { in: allEmails } } });
    await app.close();
  });

  describe("staff actions write who, what, subject, reason and time", () => {
    it("records a single clean-data run (finding S-6) with its reason and counts", async () => {
      const r = reason("single clean");
      const before = Date.now();
      await admin
        .put(`/api/admin/users/${victimId}/clean-data`)
        .send({ dataType: "all", reason: r })
        .expect(200);
      const [entry] = await entriesFor("user_data_cleaned");
      expect(entry.actorId).toBe(adminId);
      expect(entry.targetType).toBe("user");
      expect(entry.targetId).toBe(victimId);
      expect(entry.reason).toBe(r);
      expect(entry.createdAt.getTime()).toBeGreaterThanOrEqual(before - 5000);
      expect(entry.details).toMatchObject({ dataType: "all", deleted: { certificates: 0 } });
    });

    it("records a bulk clean-data run with every user id", async () => {
      const r = reason("bulk clean");
      await admin
        .put("/api/admin/users/bulk-clean-data")
        .send({ userIds: [victimId, victim2Id], dataType: "certificates", reason: r })
        .expect(200);
      const [entry] = await entriesFor("users_data_bulk_cleaned");
      expect(entry.actorId).toBe(adminId);
      expect(entry.reason).toBe(r);
      expect((entry.details as { userIds: string[] }).userIds.sort()).toEqual([victimId, victim2Id].sort());
    });

    it("refuses clean-data and user deletion without a reason of at least 10 characters", async () => {
      await admin.put(`/api/admin/users/${victimId}/clean-data`).send({ dataType: "all" }).expect(400);
      await admin.put(`/api/admin/users/${victimId}/clean-data`).send({ dataType: "all", reason: "short" }).expect(400);
      await admin
        .put("/api/admin/users/bulk-clean-data")
        .send({ userIds: [victimId], dataType: "all" })
        .expect(400);
      await admin.delete(`/api/admin/users/${victimId}`).expect(400);
      await admin.delete(`/api/admin/users/${victimId}`).send({ reason: "short" }).expect(400);
      expect(await prisma.user.count({ where: { id: victimId } })).toBe(1);
    });

    it("records a site-settings change with old and new values and the reason", async () => {
      const r = reason("settings");
      const current = originalSettings as Record<string, unknown>;
      const { id, updatedAt, createdAt, ...body } = current;
      void id;
      void updatedAt;
      void createdAt;
      const newName = `Audit ${TAG}`;
      await admin
        .put("/api/admin/settings")
        .send({ ...body, siteName: newName, reason: r })
        .expect(200);
      const [entry] = await entriesFor("site_settings_changed");
      expect(entry.actorId).toBe(adminId);
      expect(entry.reason).toBe(r);
      const d = entry.details as { changedKeys: string[]; changes: Record<string, { old: unknown; new: unknown }> };
      expect(d.changedKeys).toEqual(["siteName"]);
      expect(d.changes.siteName).toEqual({ old: current.siteName, new: newName });
    });

    it("records an optional reason on routine actions (role change)", async () => {
      const r = reason("roles");
      await admin.put(`/api/admin/users/${victim2Id}/roles`).send({ roleNames: ["moderator"], reason: r }).expect(200);
      const [entry] = await entriesFor("user_roles_changed");
      expect(entry.targetId).toBe(victim2Id);
      expect(entry.reason).toBe(r);
      // Still works with no reason: existing clients are unaffected.
      await admin.put(`/api/admin/users/${victim2Id}/roles`).send({ roleNames: ["member"] }).expect(200);
    });

    it("records admin creation through the shared-code route's helper", async () => {
      const user = await createUser(EMAILS.selfAdmin, "admin");
      await activityLog.logAdminRegistered(user.id, user.email);
      const entries = await prisma.adminActivityLog.findMany({ where: { action: "admin_registered", targetId: user.id } });
      expect(entries).toHaveLength(1);
      expect(entries[0].actorId).toBe(user.id);
      expect(entries[0].reason).toBeTruthy();
    });

    it("records user deletion with the subject id and the reason", async () => {
      const doomed = await createUser(EMAILS.doomed, "member");
      const r = reason("delete user");
      await admin.delete(`/api/admin/users/${doomed.id}`).send({ reason: r }).expect(200);
      const [entry] = await entriesFor("user_deleted");
      expect(entry.actorId).toBe(adminId);
      expect(entry.targetId).toBe(doomed.id);
      expect(entry.reason).toBe(r);
      // TASK-046: deleting a user erases them (their row stays as an empty tombstone).
      const tomb = await prisma.user.findUniqueOrThrow({ where: { id: doomed.id } });
      expect(tomb.erasedAt).not.toBeNull();
      expect(tomb.email).not.toBe(EMAILS.doomed);
      await prisma.user.delete({ where: { id: doomed.id } });
    });

    it("accepts the deletion reason as a query parameter for clients that cannot send a body", async () => {
      const doomed = await createUser(EMAILS.doomed, "member");
      const r = encodeURIComponent(reason("delete via query"));
      await admin.delete(`/api/admin/users/${doomed.id}?reason=${r}`).expect(200);
      const entries = await prisma.adminActivityLog.findMany({ where: { action: "user_deleted", targetId: doomed.id } });
      expect(entries).toHaveLength(1);
      await prisma.user.deleteMany({ where: { id: doomed.id } }); // the erased tombstone
    });
  });

  describe("the database keeps the log append-only", () => {
    let logId: string;

    beforeAll(async () => {
      const row = await activityLog.log(adminId, "user_approved", "user", victimId, { t: 1 }, reason("immutable"));
      logId = row.id;
    });

    it("rejects UPDATE of any column", async () => {
      await expect(
        prisma.$executeRaw`UPDATE admin_activity_logs SET reason = 'edited' WHERE id = ${logId}`,
      ).rejects.toThrow(/append-only/);
      await expect(
        prisma.adminActivityLog.update({ where: { id: logId }, data: { action: "user_deleted" } }),
      ).rejects.toThrow(/append-only/);
      // Nulling the actor together with any other change is also refused.
      await expect(
        prisma.$executeRaw`UPDATE admin_activity_logs SET actor_id = NULL, reason = 'x' WHERE id = ${logId}`,
      ).rejects.toThrow(/append-only/);
    });

    it("rejects DELETE and TRUNCATE", async () => {
      await expect(prisma.$executeRaw`DELETE FROM admin_activity_logs WHERE id = ${logId}`).rejects.toThrow(/append-only/);
      await expect(prisma.adminActivityLog.delete({ where: { id: logId } })).rejects.toThrow(/append-only/);
      await expect(prisma.adminActivityLog.deleteMany({ where: { id: logId } })).rejects.toThrow(/append-only/);
      await expect(prisma.$executeRawUnsafe("TRUNCATE admin_activity_logs")).rejects.toThrow(/append-only/);
    });

    it("still lets an actor account be deleted: the entry stays and actor_id becomes NULL", async () => {
      const actor = await createUser(EMAILS.doomed, "admin");
      const row = await activityLog.log(actor.id, "user_approved", "user", victimId, undefined, reason("actor deleted"));
      await prisma.user.delete({ where: { id: actor.id } });
      const after = await prisma.adminActivityLog.findUniqueOrThrow({ where: { id: row.id } });
      expect(after.actorId).toBeNull();
      expect(after.reason).toBe(row.reason);
      expect(after.action).toBe("user_approved");
      expect(after.createdAt).toEqual(row.createdAt);
    });
  });
});
