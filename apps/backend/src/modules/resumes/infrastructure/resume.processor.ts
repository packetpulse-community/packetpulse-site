import { Logger } from "@nestjs/common";
import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Job, UnrecoverableError } from "bullmq";
import { STALL_SETTINGS } from "../../notifications/infrastructure/queue/queue-config";
import { handleJobFailed, handleJobStalled, handleWorkerError } from "../../notifications/infrastructure/queue/queue-alerts";
import { ResumeParseService } from "../application/resume-parse.service";
import { JOB_PARSE, JOB_SWEEP, RESUME_QUEUE, ResumeJob } from "../application/resumes.constants";

// concurrency 1: each parse already runs in its own thread with a memory ceiling, and one at a
// time keeps the API process's headroom predictable.
@Processor(RESUME_QUEUE, { concurrency: 1, ...STALL_SETTINGS })
export class ResumeProcessor extends WorkerHost {
  private readonly logger = new Logger(ResumeProcessor.name);

  constructor(private readonly parser: ResumeParseService) {
    super();
  }

  async process(job: Job<ResumeJob>) {
    switch (job.name) {
      case JOB_PARSE:
        if (!job.data.resumeId) throw new UnrecoverableError("parse job without a resume id");
        return this.parser.process(job.data.resumeId, new Date());
      case JOB_SWEEP:
        return this.parser.sweep(new Date());
      default:
        throw new UnrecoverableError(`Unknown resume job ${job.name}`);
    }
  }

  @OnWorkerEvent("failed")
  async onFailed(job: Job<ResumeJob> | undefined, error: Error) {
    handleJobFailed(this.logger, RESUME_QUEUE, job, error, { job: job?.name });
    if (!job || job.name !== JOB_PARSE || !job.data.resumeId) return;
    const final = error instanceof UnrecoverableError || job.attemptsMade >= (job.opts.attempts ?? 1);
    if (final) await this.parser.markFailed(job.data.resumeId).catch(() => undefined);
  }

  @OnWorkerEvent("stalled")
  onStalled(jobId: string) {
    handleJobStalled(this.logger, RESUME_QUEUE, jobId);
  }

  @OnWorkerEvent("error")
  onError(error: Error) {
    handleWorkerError(this.logger, RESUME_QUEUE, error);
  }
}
