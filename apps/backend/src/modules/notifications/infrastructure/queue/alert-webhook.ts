import { Logger } from "@nestjs/common";

// TASK-016: optional webhook for final job failures and stalled jobs. The structured
// log line stays the source of truth; this only adds a push. Off when ALERT_WEBHOOK_URL is
// unset. It never throws and never blocks the worker: the send is fire-and-forget with a
// timeout, the payload is built from an allowlist of fields with the free-text reason
// scrubbed, and a failure storm sends at most one message per minute per queue (the
// suppressed count rides on the next message).

export const ALERT_WEBHOOK_TIMEOUT_MS = 3000;
export const ALERT_WEBHOOK_MIN_INTERVAL_MS = 60_000;

const logger = new Logger("AlertWebhook");
const lastSent = new Map<string, { at: number; suppressed: number }>();

// Only these fields ever leave the process. Everything else (addresses, bodies, codes) is dropped.
const SAFE_FIELDS = ["queue", "jobId", "attempts", "maxAttempts", "permanent"] as const;

// Emails, URLs (query strings can carry tokens) and long opaque strings are masked.
export function redactReason(reason: unknown): string {
  return String(reason ?? "")
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "[email]")
    .replace(/https?:\/\/\S+/gi, "[url]")
    .replace(/\b[A-Za-z0-9_\-+/=]{24,}\b/g, "[redacted]")
    .slice(0, 200);
}

export function buildAlertPayload(event: string, fields: Record<string, unknown>, suppressed = 0) {
  const safe: Record<string, unknown> = {};
  for (const k of SAFE_FIELDS) if (fields[k] !== undefined) safe[k] = fields[k];
  const reason = fields.reason === undefined ? undefined : redactReason(fields.reason);
  const text =
    `[PacketPulse] ${event} on queue ${String(safe.queue ?? "unknown")}` +
    (safe.jobId != null ? ` (job ${String(safe.jobId)})` : "") +
    (reason ? `: ${reason}` : "") +
    (suppressed > 0 ? ` (+${suppressed} more in the last minute)` : "");
  return { text, event, ...safe, ...(reason ? { reason } : {}), suppressed };
}

// Returns true when a request was started (used by tests). Never throws.
export function notifyAlertWebhook(event: string, fields: Record<string, unknown>, now = Date.now()): boolean {
  try {
    const url = process.env.ALERT_WEBHOOK_URL?.trim();
    if (!url) return false;

    const queue = String(fields.queue ?? "unknown");
    const prev = lastSent.get(queue);
    if (prev && now - prev.at < ALERT_WEBHOOK_MIN_INTERVAL_MS) {
      prev.suppressed += 1;
      return false;
    }
    const suppressed = prev?.suppressed ?? 0;
    lastSent.set(queue, { at: now, suppressed: 0 });

    const body = JSON.stringify(buildAlertPayload(event, fields, suppressed));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ALERT_WEBHOOK_TIMEOUT_MS);
    timer.unref?.();
    fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body, signal: controller.signal })
      .then((res) => {
        if (!res.ok) logger.warn(`alert webhook answered ${res.status}`);
      })
      .catch((err: unknown) => {
        // Never log the URL: it usually embeds a secret token.
        logger.warn(`alert webhook failed: ${err instanceof Error ? err.name : "error"}`);
      })
      .finally(() => clearTimeout(timer));
    return true;
  } catch {
    return false;
  }
}

export function resetAlertWebhookState() {
  lastSent.clear();
}
