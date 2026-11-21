// One queue, three jobs. The job id is derived from the request id (idempotencyJobId), so
// enqueueing the same request twice runs it once.
export const DATA_RIGHTS_QUEUE = "data-rights";
export const JOB_EXPORT = "export";
export const JOB_ERASE = "erase";
export const JOB_SWEEP = "sweep";
export const SWEEP_SCHEDULER_ID = "data-rights-sweep";
/** The sweep (due erasures, expired exports, retention) runs hourly; each step is idempotent. */
export const SWEEP_EVERY_MS = 60 * 60 * 1000;
/** A request left `requested`/`preparing` this long is assumed dropped and is queued again. */
export const STALLED_AFTER_MS = 15 * 60 * 1000;
/** An erasure claimed this long ago and still not completed crashed; the sweep takes it back. */
export const ERASE_RECLAIM_AFTER_MS = 60 * 60 * 1000;

export interface DataRightsJob {
  requestId?: string;
}
