import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { TokenService } from "../src/modules/identity/application/services/token.service";
import { toPublicUser, userWithRolesInclude } from "../src/modules/identity";
import { StorageProvider } from "../src/common/storage/storage-provider";
import { LocalStorageProvider } from "../src/common/storage/local-storage.provider";

// TEST-012 (TASK-014, SEC-03, PRD-046): private files - direct upload, scan, link expiry,
// opens logged, other users refused. The access log is append-only (a trigger refuses
// deletes), so its rows stay behind; everything else is removed.
jest.setTimeout(60_000);

describe("Private files (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let storage: LocalStorageProvider;
  const tokens: Record<string, string> = {};
  const ids: Record<string, string> = {};
  const created: string[] = [];
  const PREFIX = "pf-";

  const as = (who: string) => ({ Cookie: `accessToken=${tokens[who]}` });
  const pdf = (size: number) => {
    const b = Buffer.alloc(size, 0x20);
    b.write("%PDF-1.7\n", 0, "latin1");
    return b;
  };

  async function mkUser(name: string, role: string) {
    const user = await prisma.user.create({
      data: {
        firstName: "Files",
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
  }

  async function upload(who: string, body: object, bytes?: Buffer) {
    const res = await request(app.getHttpServer()).post("/api/files/upload-url").set(as(who)).send(body);
    if (res.status === 201 || res.status === 200) {
      created.push(res.body.file.id);
      if (bytes) await storage.putWithToken(res.body.uploadUrl, bytes);
    }
    return res;
  }
  const resumeBody = (over: object = {}) => ({
    // Resumes have their own routes since TASK-024 (resumes.e2e-spec.ts); the pipeline is the same.
    kind: "certificate",
    originalName: "cv.pdf",
    contentType: "application/pdf",
    sizeBytes: 5 * 1024 * 1024,
    ...over,
  });
  const logs = (fileId: string) => prisma.fileAccessLog.findMany({ where: { fileId }, orderBy: { createdAt: "asc" } });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix("api");
    await app.init();
    prisma = app.get(PrismaService);
    storage = app.get(StorageProvider) as LocalStorageProvider;
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await mkUser("owner", "member");
    await mkUser("other", "member");
    await mkUser("admin", "admin");
  });

  afterAll(async () => {
    for (const f of await prisma.storedFile.findMany({ where: { id: { in: created } } })) {
      await storage.delete(f.bucket, f.path);
    }
    await prisma.storedFile.deleteMany({ where: { id: { in: created } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await app.close();
  });

  describe("upload-url", () => {
    it("refuses an unauthenticated caller", async () => {
      await request(app.getHttpServer()).post("/api/files/upload-url").send(resumeBody()).expect(401);
    });
    it("refuses a content type not allowed for the kind", async () => {
      await upload("owner", resumeBody({ contentType: "image/gif" })).then((r) => expect(r.status).toBe(400));
      await upload("owner", resumeBody({ contentType: "application/x-msdownload" })).then((r) => expect(r.status).toBe(400));
    });
    it("refuses an oversize file and a bad kind", async () => {
      await upload("owner", resumeBody({ sizeBytes: 5 * 1024 * 1024 + 1 })).then((r) => expect(r.status).toBe(400));
      await upload("owner", resumeBody({ kind: "avatar" })).then((r) => expect(r.status).toBe(400));
    });
    it("returns a signed URL and a pending file, never a public link", async () => {
      const res = await upload("owner", resumeBody());
      expect(res.status).toBe(201);
      expect(res.body.file.status).toBe("pending");
      expect(res.body.uploadUrl).toContain("local-storage");
      expect(res.body.file.path).toBeUndefined();
      expect((await logs(res.body.file.id)).map((l) => l.action)).toEqual(["upload_url"]);
    });
  });

  describe("complete (scan)", () => {
    it("rejects bytes that do not match the declared type and removes the object", async () => {
      const res = await upload("owner", resumeBody({ sizeBytes: 100 }), Buffer.alloc(100, 0x41));
      const done = await request(app.getHttpServer()).post(`/api/files/${res.body.file.id}/complete`).set(as("owner"));
      expect(done.status).toBe(400);
      const row = await prisma.storedFile.findUniqueOrThrow({ where: { id: res.body.file.id } });
      expect(row.status).toBe("rejected");
      expect((await storage.headObject(row.bucket, row.path)).exists).toBe(false);
    });
    it("rejects an object whose size differs from the declared size", async () => {
      const res = await upload("owner", resumeBody({ sizeBytes: 200 }), pdf(300));
      await request(app.getHttpServer()).post(`/api/files/${res.body.file.id}/complete`).set(as("owner")).expect(400);
    });
    it("asks the client to upload first when nothing is stored", async () => {
      const res = await upload("owner", resumeBody());
      await request(app.getHttpServer()).post(`/api/files/${res.body.file.id}/complete`).set(as("owner")).expect(400);
    });
    it("only the owner may complete (others get 404, logged as denied)", async () => {
      const res = await upload("owner", resumeBody({ sizeBytes: 100 }), pdf(100));
      await request(app.getHttpServer()).post(`/api/files/${res.body.file.id}/complete`).set(as("other")).expect(404);
      expect((await logs(res.body.file.id)).map((l) => l.action)).toContain("denied");
    });
  });

  describe("a valid 5 MB PDF", () => {
    let fileId: string;
    beforeAll(async () => {
      const res = await upload("owner", resumeBody(), pdf(5 * 1024 * 1024));
      fileId = res.body.file.id;
    });

    it("cannot be opened before it is completed", async () => {
      await request(app.getHttpServer()).get(`/api/files/${fileId}/link`).set(as("owner")).expect(404);
    });

    it("passes the scan and becomes available", async () => {
      const res = await request(app.getHttpServer()).post(`/api/files/${fileId}/complete`).set(as("owner")).expect(201);
      expect(res.body.file.status).toBe("available");
    });

    it("gives the owner a 60 second link that serves the bytes, and logs the open with actor and ip", async () => {
      const res = await request(app.getHttpServer()).get(`/api/files/${fileId}/link`).set(as("owner")).expect(200);
      expect(res.body.expiresInSeconds).toBe(60);
      expect((await storage.readWithToken(res.body.url)).length).toBe(5 * 1024 * 1024);
      const open = (await logs(fileId)).filter((l) => l.action === "open");
      expect(open).toHaveLength(1);
      expect(open[0].actorId).toBe(ids.owner);
      expect(open[0].ip).toBeTruthy();
    });

    it("refuses another member with 404 and logs a denied row", async () => {
      await request(app.getHttpServer()).get(`/api/files/${fileId}/link`).set(as("other")).expect(404);
      await request(app.getHttpServer()).get(`/api/files/${fileId}/link`).expect(401);
      const denied = (await logs(fileId)).filter((l) => l.action === "denied");
      expect(denied).toHaveLength(1);
      expect(denied[0].actorId).toBe(ids.other);
    });

    it("gives an admin a link, logged", async () => {
      await request(app.getHttpServer()).get(`/api/files/${fileId}/link`).set(as("admin")).expect(200);
      expect((await logs(fileId)).some((l) => l.action === "open" && l.actorId === ids.admin)).toBe(true);
    });

    it("stops working once the link expires", async () => {
      const res = await request(app.getHttpServer()).get(`/api/files/${fileId}/link`).set(as("owner")).expect(200);
      const real = Date.now;
      jest.spyOn(Date, "now").mockImplementation(() => real() + 61_000);
      try {
        await expect(storage.readWithToken(res.body.url)).rejects.toThrow(/expired/);
      } finally {
        jest.restoreAllMocks();
      }
    });

    it("the access log refuses edits and deletes", async () => {
      await expect(prisma.fileAccessLog.deleteMany({ where: { fileId } })).rejects.toThrow();
      await expect(prisma.fileAccessLog.updateMany({ where: { fileId }, data: { ip: "x" } })).rejects.toThrow();
    });

    it("another member cannot delete it; the owner can, after which opens fail", async () => {
      await request(app.getHttpServer()).delete(`/api/files/${fileId}`).set(as("other")).expect(404);
      await request(app.getHttpServer()).delete(`/api/files/${fileId}`).set(as("owner")).expect(200);
      const row = await prisma.storedFile.findUniqueOrThrow({ where: { id: fileId } });
      expect(row.status).toBe("deleted");
      expect((await storage.headObject(row.bucket, row.path)).exists).toBe(false);
      await request(app.getHttpServer()).get(`/api/files/${fileId}/link`).set(as("owner")).expect(404);
      await request(app.getHttpServer()).get(`/api/files/${fileId}/link`).set(as("admin")).expect(404);
      expect((await logs(fileId)).some((l) => l.action === "delete" && l.actorId === ids.owner)).toBe(true);
    });
  });
});
