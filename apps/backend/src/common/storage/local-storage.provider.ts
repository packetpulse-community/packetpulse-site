import { Injectable } from "@nestjs/common";
import { randomBytes } from "crypto";
import { promises as fs } from "fs";
import { tmpdir } from "os";
import { dirname, join, normalize, sep } from "path";
import { StorageProvider } from "./storage-provider";

type Grant = { op: "upload" | "download"; bucket: string; path: string; expiresAt: number };

// PLATFORM_MODE=docker and tests: objects live in a temp directory, signed URLs are opaque
// expiring tokens held in memory. There is no HTTP route for them on purpose (a public
// upload route would be an extra attack surface); tests and local tooling use
// putWithToken / readWithToken, which enforce the same single-use-bucket and expiry rules the
// Supabase signed URLs do. Tokens are lost on restart, like a short-lived URL would be.
@Injectable()
export class LocalStorageProvider extends StorageProvider {
  private readonly grants = new Map<string, Grant>();

  constructor(private readonly root: string = join(tmpdir(), "packetpulse-local-storage")) {
    super();
  }

  private file(bucket: string, path: string): string {
    const full = normalize(join(this.root, bucket, path));
    if (!full.startsWith(join(this.root, bucket) + sep)) throw new Error("Invalid storage path");
    return full;
  }

  private grant(op: Grant["op"], bucket: string, path: string, ttlSeconds: number) {
    const token = randomBytes(24).toString("hex");
    this.grants.set(token, { op, bucket, path, expiresAt: Date.now() + ttlSeconds * 1000 });
    return { url: `http://localhost/local-storage/${token}`, token };
  }

  private redeem(urlOrToken: string, op: Grant["op"]): Grant {
    const token = urlOrToken.split("/").pop() ?? "";
    const g = this.grants.get(token);
    if (!g || g.op !== op) throw new Error("Invalid signed URL");
    if (Date.now() > g.expiresAt) {
      this.grants.delete(token);
      throw new Error("Signed URL expired");
    }
    return g;
  }

  async upload(bucket: string, path: string, file: Buffer) {
    const target = this.file(bucket, path);
    await fs.mkdir(dirname(target), { recursive: true });
    await fs.writeFile(target, file);
    return { path };
  }

  getPublicUrl(bucket: string, path: string): string {
    return `http://localhost/local-storage/public/${bucket}/${path}`;
  }

  async delete(bucket: string, path: string) {
    await fs.rm(this.file(bucket, path), { force: true });
  }

  async createSignedUploadUrl(bucket: string, path: string, ttlSeconds: number) {
    return { url: this.grant("upload", bucket, path, ttlSeconds).url };
  }

  async createSignedDownloadUrl(bucket: string, path: string, ttlSeconds: number) {
    return { url: this.grant("download", bucket, path, ttlSeconds).url };
  }

  async headObject(bucket: string, path: string) {
    try {
      const st = await fs.stat(this.file(bucket, path));
      return { exists: true, size: st.size };
    } catch {
      return { exists: false, size: 0 };
    }
  }

  async readHead(bucket: string, path: string, length: number) {
    const handle = await fs.open(this.file(bucket, path), "r");
    try {
      const buf = Buffer.alloc(length);
      const { bytesRead } = await handle.read(buf, 0, length, 0);
      return buf.subarray(0, bytesRead);
    } finally {
      await handle.close();
    }
  }

  // ---- stand-ins for what the browser / a download does with the signed URL ----
  async putWithToken(url: string, bytes: Buffer) {
    const g = this.redeem(url, "upload");
    await this.upload(g.bucket, g.path, bytes);
  }

  async readWithToken(url: string): Promise<Buffer> {
    const g = this.redeem(url, "download");
    return fs.readFile(this.file(g.bucket, g.path));
  }
}
