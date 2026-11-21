import { Logger } from "@nestjs/common";
import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Job, UnrecoverableError } from "bullmq";
import { STALL_SETTINGS } from "../../notifications/infrastructure/queue/queue-config";
import { handleJobFailed, handleJobStalled, handleWorkerError } from "../../notifications/infrastructure/queue/queue-alerts";
import { AccountErasureService } from "../application/account-erasure.service";
import { DataExportService } from "../application/data-export.service";
import { RetentionService } from "../application/retention.service";
import { DATA_RIGHTS_QUEUE, JOB_ERASE, JOB_EXPORT, JOB_SWEEP, STALLED_AFTER_MS, DataRightsJob } from "../application/data-rights.constants";

@Processor(DATA_RIGHTS_QUEUE, { concurrency: 2, ...STALL_SETTINGS })
export class DataRightsProcessor extends WorkerHost {
  private readonly logger = new Logger(DataRightsProcessor.name);

  constructor(
    private readonly exports: DataExportService,
    private readonly erasure: AccountErasureService,
    private readonly retention: RetentionService,
  ) {
    super();
  }

  async process(job: Job<DataRightsJob>) {
    const now = new Date();
    switch (job.name) {
      case JOB_EXPORT:
        if (!job.data.requestId) throw new UnrecoverableError("export job without a request id");
        return this.exports.process(job.data.requestId, now);
      case JOB_ERASE:
        if (!job.data.requestId) throw new UnrecoverableError("erase job without a request id");
        return this.erasure.erase(job.data.requestId, now);
      case JOB_SWEEP:
        return this.sweep(now);
      default:
        throw new UnrecoverableError(`Unknown data-rights job ${job.name}`);
    }
  }

  // Hourly: erasures whose grace period ended, exports past their expiry, requests the queue
  // lost, then the retention deletes. Each step is idempotent, so a repeated or overlapping
  // sweep is harmless.
  async sweep(now: Date) {
    const erasures = await this.erasure.enqueueDue(now);
    const expired = await this.exports.expireDue(now);
    const requeued = await this.exports.requeueStalled(now, STALLED_AFTER_MS);
    const retention = await this.retention.run(now);
    return { erasures, expired, requeued, retention };
  }

  @OnWorkerEvent("failed")
  async onFailed(job: Job<DataRightsJob> | undefined, error: Error) {
    handleJobFailed(this.logger, DATA_RIGHTS_QUEUE, job, error, { job: job?.name });
    if (!job || job.name !== JOB_EXPORT || !job.data.requestId) return;
    const final = error instanceof UnrecoverableError || job.attemptsMade >= (job.opts.attempts ?? 1);
    if (final) await this.exports.fail(job.data.requestId, "job_failed").catch(() => undefined);
  }

  @OnWorkerEvent("stalled")
  onStalled(jobId: string) {
    handleJobStalled(this.logger, DATA_RIGHTS_QUEUE, jobId);
  }

  @OnWorkerEvent("error")
  onError(error: Error) {
    handleWorkerError(this.logger, DATA_RIGHTS_QUEUE, error);
  }
}
