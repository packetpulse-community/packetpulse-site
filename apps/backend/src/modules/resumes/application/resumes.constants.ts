// Background work for resumes (TASK-024). One queue; the worker lives in the API process.
export const RESUME_QUEUE = "resume-parse";
export const JOB_PARSE = "parse";
export const JOB_SWEEP = "sweep";
export const SWEEP_SCHEDULER_ID = "resume-sweep";
export const SWEEP_EVERY_MS = 10 * 60 * 1000;

/** Tries per parse run for infrastructure errors (storage down, worker crash). A file problem never retries. */
export const PARSE_MAX_ATTEMPTS = 3;
/** A parse claimed longer ago than this is treated as crashed and may be claimed again. Default, not in the docs. */
export const PARSE_RECLAIM_AFTER_MS = 5 * 60 * 1000;
/** Re-queues by the sweep before a stuck resume is marked failed. */
export const MAX_PARSE_RUNS = 5;
/** An upload that was never completed is abandoned after this long (RETENTION_RULES abandoned_resume_uploads). Default, not in the docs. */
export const ABANDONED_UPLOAD_AFTER_MS = 24 * 60 * 60 * 1000;

export interface ResumeJob {
  resumeId?: string;
  /** The run number the job was queued for; part of the job id. */
  run?: number;
}

export const CURRENT_SLOT = "current";
