import { Logger } from "@nestjs/common";
import { connect, Socket } from "net";
import { FileScanner, ScanInput, ScanVerdict, ScannerUnavailableError } from "./file-scanner";

const CHUNK = 64 * 1024;

export type ClamdOptions = { host: string; port: number; timeoutMs?: number };

// TASK-014: clamd over TCP using the INSTREAM command. The cheap signature check runs first
// (wrong type or mismatched bytes are rejected without a round trip); anything it accepts is
// streamed to clamd. Fail-closed: if clamd cannot be reached, times out or answers with
// anything other than OK/FOUND, the scan throws ScannerUnavailableError and the file is NOT
// made available (the upload stays pending and the caller can retry).
export class ClamdFileScanner extends FileScanner {
  private readonly logger = new Logger("ClamdFileScanner");
  private readonly timeoutMs: number;

  constructor(
    private readonly inner: FileScanner,
    private readonly options: ClamdOptions,
  ) {
    super();
    this.timeoutMs = options.timeoutMs ?? 10_000;
  }

  async scan(input: ScanInput): Promise<ScanVerdict> {
    const first = await this.inner.scan(input);
    if (!first.clean) return first;
    if (!input.readAll) throw new ScannerUnavailableError("antivirus needs the file contents but none were provided");

    let bytes: Buffer;
    try {
      bytes = await input.readAll();
    } catch {
      throw new ScannerUnavailableError("could not read the file for scanning");
    }
    const reply = await this.instream(bytes);
    // clamd replies "stream: OK", "stream: <Signature> FOUND" or "... ERROR".
    if (/\bOK$/.test(reply)) return { clean: true, reason: "clamav: ok" };
    const found = /^stream:\s*(.+?)\s+FOUND$/.exec(reply);
    if (found) return { clean: false, reason: `malware detected (${found[1]})` };
    this.logger.error(`unexpected clamd reply: ${reply.slice(0, 120)}`);
    throw new ScannerUnavailableError("antivirus returned an unexpected answer");
  }

  private instream(bytes: Buffer): Promise<string> {
    return new Promise((resolve, reject) => {
      let settled = false;
      let socket: Socket | undefined;
      const chunks: Buffer[] = [];
      const done = (err: Error | null, value?: string) => {
        if (settled) return;
        settled = true;
        socket?.destroy();
        if (err) {
          this.logger.error(`clamd scan failed: ${err.message}`);
          reject(new ScannerUnavailableError("antivirus is unavailable"));
        } else resolve(value ?? "");
      };
      socket = connect({ host: this.options.host, port: this.options.port });
      socket.setTimeout(this.timeoutMs, () => done(new Error("timeout")));
      socket.on("error", (e) => done(e));
      socket.on("close", () => done(new Error("connection closed before a reply")));
      socket.on("data", (d) => {
        chunks.push(d);
        const text = Buffer.concat(chunks).toString("utf8");
        const end = text.indexOf("\0");
        if (end >= 0) done(null, text.slice(0, end).trim());
      });
      socket.on("connect", () => {
        const s = socket!;
        s.write("zINSTREAM\0");
        for (let i = 0; i < bytes.length; i += CHUNK) {
          const part = bytes.subarray(i, i + CHUNK);
          const len = Buffer.alloc(4);
          len.writeUInt32BE(part.length);
          s.write(len);
          s.write(part);
        }
        s.write(Buffer.alloc(4)); // zero-length chunk ends the stream
      });
    });
  }
}
