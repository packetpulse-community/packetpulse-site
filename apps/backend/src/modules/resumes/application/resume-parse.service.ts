import { Injectable, Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";
import { Prisma } from "@prisma/client";
import { RESUME_PARSE_TIMEOUT_MS } from "@packetpulse/types";
import type { ResumeFailureCode } from "@packetpulse/types";
import { PrismaService } from "../../../prisma/prisma.service";
import { StorageProvider } from "../../../common/storage/storage-provider";
import { matchKeyOf } from "../../skills/domain/skill-keys";
import { DocumentExtractor } from "../infrastructure/document-extractor";
import { parseResumeText, SkillIndexEntry } from "../domain/resume-text-parser";
import { JOB_PARSE, MAX_PARSE_RUNS, PARSE_MAX_ATTEMPTS, PARSE_RECLAIM_AFTER_MS, RESUME_QUEUE, ResumeJob, ABANDONED_UPLOAD_AFTER_MS } from "./resumes.constants";
import { idempotencyJobId } from "../../notifications/infrastructure/queue/queue-config";

const PDF = "application/pdf";
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export type ParseOutcome = "parsed" | "failed" | "rejected" | "skipped";

// The background job (TASK-024). Idempotent: a run claims the resume with a conditional update, so
// a second worker (or a repeated job) finds nothing to claim and skips; suggestions carry a
// fingerprint, so even a re-run after a crash adds nothing twice. The file is read as bytes and
// handed to an isolated worker thread (time and memory limited) that only extracts text. Nothing
// in the document is executed, and the profile is never touched: suggestions wait for the member.
@Injectable()
export class ResumeParseService {
  private readonly logger = new Logger(ResumeParseService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageProvider,
    private readonly extractor: DocumentExtractor,
    private readonly config: ConfigService,
    @InjectQueue(RESUME_QUEUE) private readonly queue: Queue<ResumeJob>,
  ) {}

  private async skillIndex(): Promise<SkillIndexEntry[]> {
    const skills = await this.prisma.skill.findMany({ where: { status: "active" }, select: { id: true, name: true, level: true, aliases: { select: { alias: true } } } });
    return skills.map((s) => ({ id: s.id, name: s.name, level: s.level, keys: [matchKeyOf(s.name), ...s.aliases.map((a) => matchKeyOf(a.alias))] }));
  }

  async process(resumeId: string, now = new Date(), timeoutMs = RESUME_PARSE_TIMEOUT_MS): Promise<ParseOutcome> {
    const claimed = await this.prisma.resume.updateMany({
      where: { id: resumeId, status: "parsing", OR: [{ parseStartedAt: null }, { parseStartedAt: { lte: new Date(now.getTime() - PARSE_RECLAIM_AFTER_MS) } }] },
      data: { parseStartedAt: now },
    });
    if (claimed.count === 0) return "skipped";

    const resume = await this.prisma.resume.findUnique({ where: { id: resumeId }, include: { file: true } });
    if (!resume || resume.file.status !== "available") return this.finish(resumeId, "failed", "failed", now);
    const kind = resume.file.contentType === PDF ? "pdf" : resume.file.contentType === DOCX ? "docx" : null;
    if (!kind) return this.finish(resumeId, "failed", "unreadable", now);

    try {
      // Throws (and the job retries) only for infrastructure problems: storage unreachable, worker crash.
      const bytes = await this.storage.readHead(resume.file.bucket, resume.file.path, resume.file.sizeBytes);
      const result = await this.extractor.extract(bytes, kind, timeoutMs);
      if (!result.ok) {
        if (result.code === "unsafe_content") {
          // Active content (macros, scripts, embedded files): the file is destroyed, not kept.
          await this.storage.delete(resume.file.bucket, resume.file.path);
          await this.prisma.storedFile.update({ where: { id: resume.fileId }, data: { status: "rejected", scanResult: "active content found in the document" } });
          return this.finish(resumeId, "rejected", "unsafe_content", now);
        }
        return this.finish(resumeId, "failed", result.code, now);
      }

      const held = new Set((await this.prisma.memberSkill.findMany({ where: { userId: resume.userId }, select: { skillId: true } })).map((m) => m.skillId));
      const suggestions = parseResumeText(result.text, await this.skillIndex(), held, now);
      return await this.prisma.$transaction(async (tx) => {
        // Only a resume that is still waiting for this result takes it (it may have been deleted or replaced meanwhile).
        const own = await tx.resume.updateMany({ where: { id: resumeId, status: "parsing" }, data: { status: "ready", parsedAt: now, failureCode: null } });
        if (own.count === 0) return "skipped" as const;
        if (suggestions.length > 0) {
          await tx.resumeSuggestion.createMany({
            data: suggestions.map((s) => ({ resumeId, userId: resume.userId, kind: s.kind, data: s.data as unknown as Prisma.InputJsonValue, fingerprint: s.fingerprint })),
            skipDuplicates: true,
          });
        }
        return "parsed" as const;
      });
    } catch (err) {
      // Release the claim so the queue's retry can take it.
      await this.prisma.resume.updateMany({ where: { id: resumeId, status: "parsing" }, data: { parseStartedAt: null } });
      throw err;
    }
  }

  private async finish(resumeId: string, status: "failed" | "rejected", code: ResumeFailureCode, now: Date): Promise<ParseOutcome> {
    const done = await this.prisma.resume.updateMany({ where: { id: resumeId, status: "parsing" }, data: { status, failureCode: code, parsedAt: now } });
    return done.count === 0 ? "skipped" : status;
  }

  /** The queue gave up (all attempts used): the member sees a plain "could not read" state. */
  async markFailed(resumeId: string, now = new Date()) {
    await this.finish(resumeId, "failed", "failed", now);
  }

  // Hourly-ish housekeeping, safe to repeat: queue parses the queue lost, give up on stuck ones,
  // and drop uploads that were never completed.
  async sweep(now: Date): Promise<{ requeued: number; failed: number; abandoned: number }> {
    const stuck = await this.prisma.resume.findMany({
      where: {
        status: "parsing",
        OR: [
          { parseStartedAt: null, updatedAt: { lte: new Date(now.getTime() - PARSE_RECLAIM_AFTER_MS) } },
          { parseStartedAt: { lte: new Date(now.getTime() - PARSE_RECLAIM_AFTER_MS) } },
        ],
      },
      select: { id: true, parseRun: true },
    });
    let requeued = 0;
    let failed = 0;
    for (const r of stuck) {
      if (r.parseRun >= MAX_PARSE_RUNS) {
        await this.markFailed(r.id, now);
        failed++;
        continue;
      }
      const bumped = await this.prisma.resume.updateMany({ where: { id: r.id, status: "parsing", parseRun: r.parseRun }, data: { parseRun: { increment: 1 }, parseStartedAt: null } });
      if (bumped.count === 0) continue;
      await this.queue
        .add(JOB_PARSE, { resumeId: r.id, run: r.parseRun + 1 }, {
          jobId: idempotencyJobId("resume-parse", r.id, String(r.parseRun + 1)),
          attempts: PARSE_MAX_ATTEMPTS,
          backoff: { type: "exponential", delay: Number(this.config.get("QUEUE_BACKOFF_MS")) || 30_000 },
          removeOnComplete: { age: 86_400, count: 1000 },
          removeOnFail: { age: 7 * 86_400, count: 1000 },
        })
        .catch((e: Error) => this.logger.warn(`Resume ${r.id} not re-queued: ${e.message}`));
      requeued++;
    }

    const old = await this.prisma.resume.findMany({
      where: { status: "awaiting_upload", createdAt: { lte: new Date(now.getTime() - ABANDONED_UPLOAD_AFTER_MS) } },
      include: { file: { select: { id: true, bucket: true, path: true } } },
      take: 200,
    });
    for (const r of old) {
      await this.storage.delete(r.file.bucket, r.file.path).catch(() => undefined);
      await this.prisma.storedFile.update({ where: { id: r.file.id }, data: { status: "deleted" } });
      await this.prisma.resume.deleteMany({ where: { id: r.id } });
    }
    return { requeued, failed, abandoned: old.length };
  }
}
