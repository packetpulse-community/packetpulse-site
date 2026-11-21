import { Injectable, Logger } from "@nestjs/common";
import { join } from "path";
import { Worker } from "worker_threads";
import { RESUME_PARSE_TIMEOUT_MS } from "@packetpulse/types";
import type { ResumeFailureCode } from "@packetpulse/types";

export type ExtractResult = { ok: true; text: string; pages: number | null } | { ok: false; code: ResumeFailureCode };

// The worker thread's heap ceiling. Generous for a 5 MB resume, small enough that a hostile file
// kills only its own thread (the API process keeps running).
const WORKER_LIMITS = { maxOldGenerationSizeMb: 192, maxYoungGenerationSizeMb: 32, stackSizeMb: 4 } as const;

// Runs extract.worker.cjs for one file with a hard time limit and a memory ceiling. The worker
// file is plain CommonJS next to this one (copied to dist by nest-cli "assets").
@Injectable()
export class DocumentExtractor {
  private readonly logger = new Logger(DocumentExtractor.name);

  extract(bytes: Buffer, kind: "pdf" | "docx", timeoutMs = RESUME_PARSE_TIMEOUT_MS): Promise<ExtractResult> {
    return new Promise<ExtractResult>((resolve, reject) => {
      let settled = false;
      const done = (fn: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        fn();
      };
      const worker = new Worker(join(__dirname, "extract.worker.cjs"), {
        workerData: { kind, bytes: new Uint8Array(bytes) },
        resourceLimits: WORKER_LIMITS,
        stdout: true,
        stderr: true,
      });
      const timer = setTimeout(() => {
        done(() => resolve({ ok: false, code: "timeout" }));
        void worker.terminate();
      }, timeoutMs);
      worker.once("message", (msg: ExtractResult) => {
        done(() => resolve(msg));
        void worker.terminate();
      });
      worker.once("error", (err: Error & { code?: string }) => {
        // Out of memory in the thread: the file is the cause, retrying cannot help.
        if (err.code === "ERR_WORKER_OUT_OF_MEMORY") return done(() => resolve({ ok: false, code: "too_complex" }));
        this.logger.warn(`Resume extraction worker crashed: ${err.code ?? err.name}`);
        done(() => reject(err));
      });
      worker.once("exit", (code) => {
        if (code !== 0) done(() => reject(new Error(`extraction worker exited with ${code}`)));
        else done(() => reject(new Error("extraction worker ended without a result")));
      });
    });
  }
}
