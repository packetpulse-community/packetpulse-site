import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import * as net from "net";
import { AddressInfo } from "net";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { TokenService } from "../src/modules/identity/application/services/token.service";
import { toPublicUser, userWithRolesInclude } from "../src/modules/identity";
import { StorageProvider } from "../src/common/storage/storage-provider";
import { LocalStorageProvider } from "../src/common/storage/local-storage.provider";
import { FileScanner, ScanInput, ScannerUnavailableError } from "../src/modules/files/domain/file-scanner";
import { SignatureFileScanner } from "../src/modules/files/domain/signature-file-scanner";
import { ClamdFileScanner } from "../src/modules/files/domain/clamav-file-scanner";
import { createFileScanner } from "../src/modules/files/domain/file-scanner.factory";

// TASK-014: the optional ClamAV adapter, tested against a fake clamd socket. No ClamAV is
// needed to run this suite.
jest.setTimeout(60_000);

// A minimal clamd: parses zINSTREAM framing, records the bytes and answers like clamd does.
type Fake = { port: number; received: Buffer[]; close: () => Promise<void>; commands: string[] };
async function fakeClamd(reply: (data: Buffer) => string | null): Promise<Fake> {
  const received: Buffer[] = [];
  const commands: string[] = [];
  const sockets = new Set<net.Socket>();
  const server = net.createServer((sock) => {
    sockets.add(sock);
    sock.on("error", () => undefined);
    let buf = Buffer.alloc(0);
    let cmdRead = false;
    const parts: Buffer[] = [];
    sock.on("data", (d) => {
      buf = Buffer.concat([buf, d]);
      if (!cmdRead) {
        const nul = buf.indexOf(0);
        if (nul < 0) return;
        commands.push(buf.subarray(0, nul).toString());
        buf = buf.subarray(nul + 1);
        cmdRead = true;
      }
      for (;;) {
        if (buf.length < 4) return;
        const len = buf.readUInt32BE(0);
        if (len === 0) {
          const all = Buffer.concat(parts);
          received.push(all);
          const r = reply(all);
          if (r !== null) sock.end(r + "\0");
          return;
        }
        if (buf.length < 4 + len) return;
        parts.push(buf.subarray(4, 4 + len));
        buf = buf.subarray(4 + len);
      }
    });
    sock.on("close", () => sockets.delete(sock));
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  return {
    port: (server.address() as AddressInfo).port,
    received,
    commands,
    close: () => new Promise<void>((r) => { sockets.forEach((s) => s.destroy()); server.close(() => r()); }),
  };
}

const pdfBytes = (size = 200_000) => {
  const b = Buffer.alloc(size, 0x20);
  b.write("%PDF-1.7\n", 0, "latin1");
  return b;
};
const inputFor = (bytes: Buffer, over: Partial<ScanInput> = {}): ScanInput => ({
  bucket: "b",
  path: "p",
  contentType: "application/pdf",
  sizeBytes: bytes.length,
  kind: "resume",
  head: bytes.subarray(0, 16),
  readAll: async () => bytes,
  ...over,
});

describe("ClamdFileScanner (fake clamd)", () => {
  const sig = new SignatureFileScanner();
  let fake: Fake | undefined;
  afterEach(async () => { await fake?.close(); fake = undefined; });
  const scanner = (port: number, timeoutMs = 1000) => new ClamdFileScanner(sig, { host: "127.0.0.1", port, timeoutMs });

  it("streams the whole file with INSTREAM framing and accepts an OK answer", async () => {
    fake = await fakeClamd(() => "stream: OK");
    const bytes = pdfBytes(200_000); // several 64 KiB chunks
    const verdict = await scanner(fake.port).scan(inputFor(bytes));
    expect(verdict.clean).toBe(true);
    expect(fake.commands).toEqual(["zINSTREAM"]);
    expect(fake.received[0].equals(bytes)).toBe(true);
  });

  it("rejects a file clamd reports as infected and names the signature", async () => {
    fake = await fakeClamd(() => "stream: Eicar-Test-Signature FOUND");
    const verdict = await scanner(fake.port).scan(inputFor(pdfBytes(1000)));
    expect(verdict).toEqual({ clean: false, reason: "malware detected (Eicar-Test-Signature)" });
  });

  it("rejects by signature without contacting clamd when the bytes do not match the type", async () => {
    fake = await fakeClamd(() => "stream: OK");
    const bad = Buffer.from("MZ not a pdf at all.....");
    const verdict = await scanner(fake.port).scan(inputFor(bad));
    expect(verdict.clean).toBe(false);
    expect(fake.commands).toHaveLength(0);
  });

  it("fails closed when clamd is unreachable", async () => {
    fake = await fakeClamd(() => "stream: OK");
    const port = fake.port;
    await fake.close();
    fake = undefined;
    await expect(scanner(port).scan(inputFor(pdfBytes(100)))).rejects.toBeInstanceOf(ScannerUnavailableError);
  });

  it("fails closed when clamd never answers (timeout)", async () => {
    fake = await fakeClamd(() => null);
    const started = Date.now();
    await expect(scanner(fake.port, 200).scan(inputFor(pdfBytes(100)))).rejects.toBeInstanceOf(ScannerUnavailableError);
    expect(Date.now() - started).toBeLessThan(3000);
  });

  it("fails closed on a clamd ERROR or an unexpected answer", async () => {
    fake = await fakeClamd(() => "INSTREAM size limit exceeded. ERROR");
    await expect(scanner(fake.port).scan(inputFor(pdfBytes(100)))).rejects.toBeInstanceOf(ScannerUnavailableError);
  });

  it("fails closed when the connection drops without a reply", async () => {
    fake = await fakeClamd(() => "");
    // empty answer = just a NUL terminator, not OK
    await expect(scanner(fake.port).scan(inputFor(pdfBytes(100)))).rejects.toBeInstanceOf(ScannerUnavailableError);
  });
});

describe("createFileScanner", () => {
  const sig = new SignatureFileScanner();
  it("is the plain signature scanner when CLAMAV_HOST is unset or blank", () => {
    expect(createFileScanner(sig, {})).toBe(sig);
    expect(createFileScanner(sig, { CLAMAV_HOST: "  " })).toBe(sig);
  });
  it("uses clamd when CLAMAV_HOST is set, and rejects a bad port", () => {
    expect(createFileScanner(sig, { CLAMAV_HOST: "clamav", CLAMAV_PORT: "3310" })).toBeInstanceOf(ClamdFileScanner);
    expect(() => createFileScanner(sig, { CLAMAV_HOST: "clamav", CLAMAV_PORT: "abc" })).toThrow(/CLAMAV_PORT/);
  });
});

describe("Upload completion with clamd (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let storage: LocalStorageProvider;
  let fake: Fake | undefined;
  let mode: "ok" | "found";
  let token: string;
  const created: string[] = [];
  const PREFIX = "clam-";

  beforeAll(async () => {
    // clamd answers per `mode`; the port is replaced by closing it for the outage case.
    fake = await fakeClamd(() => (mode === "found" ? "stream: Win.Test.EICAR_HDB-1 FOUND" : "stream: OK"));
    const scanner = new ClamdFileScanner(new SignatureFileScanner(), { host: "127.0.0.1", port: fake.port, timeoutMs: 500 });
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(FileScanner).useValue(scanner).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix("api");
    await app.init();
    prisma = app.get(PrismaService);
    storage = app.get(StorageProvider) as LocalStorageProvider;
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
    const user = await prisma.user.create({
      data: { firstName: "Clam", lastName: "Owner", email: `${PREFIX}owner@example.com`, isApproved: true, emailVerified: true, roles: { create: [{ role: { connect: { name: "member" } } }] } },
      include: userWithRolesInclude,
    });
    token = app.get(TokenService).signAccessToken(toPublicUser(user));
  });

  afterAll(async () => {
    for (const f of await prisma.storedFile.findMany({ where: { id: { in: created } } })) await storage.delete(f.bucket, f.path);
    await prisma.storedFile.deleteMany({ where: { id: { in: created } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await fake?.close();
    await app.close();
  });

  async function uploaded(bytes: Buffer) {
    const res = await request(app.getHttpServer())
      .post("/api/files/upload-url")
      .set("Cookie", `accessToken=${token}`)
      .send({ kind: "resume", originalName: "cv.pdf", contentType: "application/pdf", sizeBytes: bytes.length })
      .expect(201);
    created.push(res.body.file.id);
    await storage.putWithToken(res.body.uploadUrl, bytes);
    return res.body.file.id as string;
  }
  const complete = (id: string) => request(app.getHttpServer()).post(`/api/files/${id}/complete`).set("Cookie", `accessToken=${token}`);

  it("a clean verdict makes the file available", async () => {
    mode = "ok";
    const id = await uploaded(pdfBytes(5000));
    const res = await complete(id).expect(201);
    expect(res.body.file.status).toBe("available");
  });

  it("an infected verdict rejects the file and deletes the object", async () => {
    mode = "found";
    const id = await uploaded(pdfBytes(5000));
    await complete(id).expect(400);
    const row = await prisma.storedFile.findUniqueOrThrow({ where: { id } });
    expect(row.status).toBe("rejected");
    expect(row.scanResult).toContain("malware detected");
    expect((await storage.headObject(row.bucket, row.path)).exists).toBe(false);
  });

  it("when clamd is down the answer is 503, the file stays pending and is never made available", async () => {
    mode = "ok";
    const id = await uploaded(pdfBytes(5000));
    await fake!.close(); // clamd goes away
    fake = undefined;
    await complete(id).expect(503);
    const row = await prisma.storedFile.findUniqueOrThrow({ where: { id } });
    expect(row.status).toBe("pending");
    await request(app.getHttpServer()).get(`/api/files/${id}/link`).set("Cookie", `accessToken=${token}`).expect(404);
  });
});
