import { ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";
import { Prisma } from "@prisma/client";
import { DAY_MS, EXPORT_AVAILABLE_DAYS, EXPORT_LINK_TTL_SECONDS, EXPORT_MAX_ATTEMPTS, DataExportLink } from "@packetpulse/types";
import { PrismaService } from "../../../prisma/prisma.service";
import { StorageProvider } from "../../../common/storage/storage-provider";
import { frontendUrl } from "../../../common/config/frontend-url";
import { FeatureFlagsService } from "../../feature-flags/feature-flags.service";
import { AdminActivityLogService } from "../../admin/application/services/admin-activity-log.service";
import { EmailQueueService } from "../../notifications";
import { idempotencyJobId } from "../../notifications/infrastructure/queue/queue-config";
import { ExportCollectorService } from "./export-collector.service";
import { createZip } from "./zip";
import { DATA_RIGHTS_QUEUE, JOB_EXPORT, DataRightsJob } from "./data-rights.constants";
import { toView } from "./data-request.view";

const OPEN = "open";

@Injectable()
export class DataExportService {
  private readonly logger = new Logger(DataExportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageProvider,
    private readonly config: ConfigService,
    private readonly flags: FeatureFlagsService,
    private readonly audit: AdminActivityLogService,
    private readonly collector: ExportCollectorService,
    private readonly emails: EmailQueueService,
    @InjectQueue(DATA_RIGHTS_QUEUE) private readonly queue: Queue<DataRightsJob>,
  ) {}

  private get bucket() {
    return this.config.get<string>("STORAGE_PRIVATE_BUCKET") ?? "private-files";
  }

  async enqueue(requestId: string, opts: { replaceFinished?: boolean } = {}) {
    // A finished job with this id is remembered for a day and would swallow a re-queue.
    if (opts.replaceFinished) {
      const old = await this.queue.getJob(idempotencyJobId("data-export", requestId));
      if (old && ((await old.isFailed()) || (await old.isCompleted()))) await old.remove();
    }
    return this.queue.add(
      JOB_EXPORT,
      { requestId },
      {
        jobId: idempotencyJobId("data-export", requestId),
        attempts: EXPORT_MAX_ATTEMPTS,
        backoff: { type: "exponential", delay: Number(this.config.get("QUEUE_BACKOFF_MS")) || 30_000 },
        removeOnComplete: { age: DAY_MS / 1000, count: 1000 },
        removeOnFail: { age: 7 * DAY_MS / 1000, count: 1000 },
      },
    );
  }

  // One open export per member. A prepared export whose time ran out is closed first, so the
  // member is never stuck behind a file that can no longer be downloaded.
  async request(userId: string, now = new Date()) {
    await this.flags.assertEnabled("data_rights.export", "Data export");
    await this.closeExpiredFor(userId, now);
    let created;
    try {
      created = await this.prisma.$transaction(async (tx) => {
        const row = await tx.dataRequest.create({ data: { userId, kind: "export", status: "requested", activeSlot: OPEN, requestedAt: now } });
        await this.audit.log(userId, "data_export_requested", "data_request", row.id, undefined, undefined, tx);
        return row;
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException("You already have a data export in progress or ready to download.");
      }
      throw err;
    }
    // If this enqueue is lost the hourly sweep queues the request again (same job id).
    await this.enqueue(created.id).catch((err: Error) => this.logger.warn(`Export ${created.id} not queued yet: ${err.message}`));
    return toView(created);
  }

  async latest(userId: string, now = new Date()) {
    await this.closeExpiredFor(userId, now);
    const row = await this.prisma.dataRequest.findFirst({ where: { userId, kind: "export" }, orderBy: { requestedAt: "desc" } });
    return row ? toView(row) : null;
  }

  // A short-lived signed link, minted on demand for the member who owns the export. Each one is
  // logged in the file access log and the audit log; the email only points at the page.
  async link(userId: string, ip: string | undefined, now = new Date()): Promise<DataExportLink> {
    await this.closeExpiredFor(userId, now);
    const row = await this.prisma.dataRequest.findFirst({
      where: { userId, kind: "export", status: "ready" },
      include: { file: true },
    });
    if (!row?.file || row.file.status !== "available") throw new NotFoundException("There is no export ready to download.");
    const { url } = await this.storage.createSignedDownloadUrl(row.file.bucket, row.file.path, EXPORT_LINK_TTL_SECONDS);
    await this.prisma.$transaction(async (tx) => {
      await tx.fileAccessLog.create({ data: { fileId: row.file!.id, actorId: userId, action: "open", ip: ip ?? null } });
      await this.audit.log(userId, "data_export_downloaded", "data_request", row.id, undefined, undefined, tx);
    });
    return { url, expiresInSeconds: EXPORT_LINK_TTL_SECONDS, fileName: "packetpulse-data-export.zip" };
  }

  // The member throws the export away (and may ask for a new one).
  async discard(userId: string) {
    const row = await this.prisma.dataRequest.findFirst({ where: { userId, kind: "export", activeSlot: OPEN } });
    if (!row) throw new NotFoundException("There is no open export to discard.");
    const closed = await this.prisma.dataRequest.updateMany({
      where: { id: row.id, activeSlot: OPEN },
      data: { status: "cancelled", activeSlot: null, cancelledAt: new Date() },
    });
    if (closed.count === 1) {
      await this.removeFile(row.id);
      await this.audit.log(userId, "data_export_discarded", "data_request", row.id);
    }
    return { success: true };
  }

  // Idempotent: a request that is no longer requested/preparing (finished, cancelled, expired) is
  // skipped, and a retry after a crash overwrites the same storage path.
  async process(requestId: string, now = new Date()): Promise<"done" | "skipped"> {
    const claimed = await this.prisma.dataRequest.updateMany({
      where: { id: requestId, kind: "export", status: { in: ["requested", "preparing"] } },
      data: { status: "preparing", startedAt: now, attempts: { increment: 1 } },
    });
    if (claimed.count === 0) return "skipped";
    const request = await this.prisma.dataRequest.findUniqueOrThrow({ where: { id: requestId } });
    const files = await this.collector.collect(request.userId, now);
    if (!files) {
      await this.fail(requestId, "user_missing");
      return "skipped";
    }
    const bytes = createZip(files);
    const path = `${request.userId}/exports/${requestId}.zip`;
    await this.storage.upload(this.bucket, path, bytes, "application/zip");

    try {
      const expiresAt = new Date(now.getTime() + EXPORT_AVAILABLE_DAYS * DAY_MS);
      await this.prisma.$transaction(async (tx) => {
        const file = await tx.storedFile.create({
          data: {
            ownerId: request.userId,
            kind: "data_export",
            originalName: "packetpulse-data-export.zip",
            contentType: "application/zip",
            sizeBytes: bytes.length,
            bucket: this.bucket,
            path,
            status: "available",
            scanResult: "generated by PacketPulse",
          },
        });
        const done = await tx.dataRequest.updateMany({
          where: { id: requestId, status: "preparing" },
          data: { status: "ready", readyAt: now, expiresAt, fileId: file.id },
        });
        // Discarded while it was being built: undo, the file is removed below.
        if (done.count !== 1) throw new AbortedExport();
        await this.audit.log(request.userId, "data_export_ready", "data_request", requestId, { sizeBytes: bytes.length }, undefined, tx);
      });
    } catch (err) {
      if (err instanceof AbortedExport) {
        await this.storage.delete(this.bucket, path);
        return "skipped";
      }
      throw err;
    }
    await this.notifyReady(request.userId, requestId, new Date(now.getTime() + EXPORT_AVAILABLE_DAYS * DAY_MS));
    return "done";
  }

  // Called when the queue gives up on a job.
  async fail(requestId: string, code: string) {
    await this.prisma.dataRequest.updateMany({
      where: { id: requestId, kind: "export", status: { in: ["requested", "preparing"] } },
      data: { status: "failed", activeSlot: null, failureCode: code },
    });
  }

  private async notifyReady(userId: string, requestId: string, expiresAt: Date) {
    try {
      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true, emailVerified: true } });
      if (!user) return;
      await this.emails.sendDataRightsNotice(
        user.email,
        { name: "data-rights-notice", kind: "export-ready", link: `${frontendUrl(this.config)}/settings/data-rights`, date: expiresAt.toISOString().slice(0, 10) },
        { userId, type: "data_export_ready", key: `export-ready-${requestId}` },
      );
    } catch (err) {
      // The export is ready and shown on the page; a failed email must not undo or retry it.
      this.logger.warn(`Export ${requestId} ready but the notice failed: ${(err as Error).message}`);
    }
  }

  // Closes this member's prepared export when its time is up.
  private async closeExpiredFor(userId: string, now: Date) {
    const due = await this.prisma.dataRequest.findMany({ where: { userId, kind: "export", status: "ready", expiresAt: { lte: now } }, select: { id: true } });
    for (const r of due) await this.expire(r.id, now);
  }

  // Sweep entry point: every export past its expiry, for all members.
  async expireDue(now: Date): Promise<number> {
    const due = await this.prisma.dataRequest.findMany({ where: { kind: "export", status: "ready", expiresAt: { lte: now } }, select: { id: true } });
    let n = 0;
    for (const r of due) if (await this.expire(r.id, now)) n++;
    return n;
  }

  private async expire(requestId: string, now: Date) {
    const closed = await this.prisma.dataRequest.updateMany({
      where: { id: requestId, status: "ready" },
      data: { status: "expired", activeSlot: null },
    });
    if (closed.count !== 1) return false;
    await this.removeFile(requestId);
    const row = await this.prisma.dataRequest.findUnique({ where: { id: requestId }, select: { userId: true } });
    await this.audit.log(row?.userId ?? null, "data_export_expired", "data_request", requestId, { at: now.toISOString() });
    return true;
  }

  // Deletes the bytes and the file row (the request row stays as the record).
  private async removeFile(requestId: string) {
    const row = await this.prisma.dataRequest.findUnique({ where: { id: requestId }, include: { file: true } });
    if (!row?.file) return;
    await this.storage.delete(row.file.bucket, row.file.path);
    await this.prisma.storedFile.delete({ where: { id: row.file.id } });
  }

  // Requests the queue lost (a crash between the insert and the add, or a dead worker).
  async requeueStalled(now: Date, olderThanMs: number): Promise<number> {
    const stalled = await this.prisma.dataRequest.findMany({
      where: { kind: "export", status: { in: ["requested", "preparing"] }, updatedAt: { lte: new Date(now.getTime() - olderThanMs) } },
      select: { id: true, attempts: true },
    });
    let n = 0;
    for (const r of stalled) {
      if (r.attempts >= EXPORT_MAX_ATTEMPTS) {
        await this.fail(r.id, "too_many_attempts");
        continue;
      }
      await this.prisma.dataRequest.updateMany({ where: { id: r.id, status: "preparing" }, data: { status: "requested" } });
      await this.enqueue(r.id, { replaceFinished: true });
      n++;
    }
    return n;
  }
}

class AbortedExport extends Error {}
