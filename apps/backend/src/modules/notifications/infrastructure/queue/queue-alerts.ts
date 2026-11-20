import { Logger } from "@nestjs/common";
import { Job, UnrecoverableError } from "bullmq";
import { notifyAlertWebhook } from "./alert-webhook";

export function recipientDomain(address: string | undefined): string {
  const at = address?.lastIndexOf("@") ?? -1;
  return address && at >= 0 ? address.slice(at + 1).toLowerCase() : "unknown";
}

// One JSON line per final failure / stall. Log-based alerting matches `"alert":true`.
// Never pass message bodies, codes, links or full addresses in `extra`.
export function logQueueAlert(
  logger: Logger,
  event: "job_failed" | "job_stalled" | "worker_error",
  fields: Record<string, unknown>,
) {
  logger.error(JSON.stringify({ alert: true, event, ...fields }));
  // Optional push (ALERT_WEBHOOK_URL). Rate-limited, redacted and never throws.
  notifyAlertWebhook(event, fields);
}

export function handleJobFailed(
  logger: Logger,
  queue: string,
  job: Job | undefined,
  error: Error,
  extra: Record<string, unknown> = {},
) {
  if (!job) {
    logQueueAlert(logger, "job_failed", { queue, jobId: null, reason: error.message });
    return;
  }
  const attempts = job.opts.attempts ?? 1;
  const final = error instanceof UnrecoverableError || job.attemptsMade >= attempts;
  if (final) {
    logQueueAlert(logger, "job_failed", {
      queue,
      jobId: job.id,
      attempts: job.attemptsMade,
      maxAttempts: attempts,
      permanent: error instanceof UnrecoverableError,
      reason: error.message,
      ...extra,
    });
  } else {
    logger.warn(
      JSON.stringify({
        alert: false,
        event: "job_retry",
        queue,
        jobId: job.id,
        attempts: job.attemptsMade,
        maxAttempts: attempts,
        reason: error.message,
        ...extra,
      }),
    );
  }
}

export function handleJobStalled(logger: Logger, queue: string, jobId: string) {
  logQueueAlert(logger, "job_stalled", { queue, jobId });
}

export function handleWorkerError(logger: Logger, queue: string, error: Error) {
  logQueueAlert(logger, "worker_error", { queue, reason: error.message });
}
