import { NOTIFICATION_POLICY_DEFAULTS } from "@packetpulse/types";

// Pure time helpers for quiet hours and the daily cap (PRD-041, Document 1 section 10.3).
// No I/O, so they are unit-testable with a fixed `now`.

export interface QuietHoursConfig {
  enabled: boolean;
  start: string; // "HH:MM" local to `timezone`
  end: string;
  timezone: string;
}

export interface QuietHoursState {
  inQuietHours: boolean;
  /** When the window ends (only set while inside it). */
  resumeAt?: Date;
  delayMs?: number;
}

const toMinutes = (hhmm: string) => {
  const [h = 0, m = 0] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

function validTimezone(tz: string): string {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: tz });
    return tz;
  } catch {
    return NOTIFICATION_POLICY_DEFAULTS.timezone;
  }
}

/** Wall-clock time of `now` in `timezone`. */
export function localClock(now: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: validTimezone(timezone),
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return { hour: get("hour") % 24, minute: get("minute"), second: get("second") };
}

export function quietHoursState(now: Date, cfg: QuietHoursConfig): QuietHoursState {
  if (!cfg.enabled) return { inQuietHours: false };
  const start = toMinutes(cfg.start);
  const end = toMinutes(cfg.end);
  if (start === end) return { inQuietHours: false }; // an empty window
  const c = localClock(now, cfg.timezone);
  const minute = c.hour * 60 + c.minute;
  // The window may wrap midnight (21:00 to 08:00).
  const inside = start < end ? minute >= start && minute < end : minute >= start || minute < end;
  if (!inside) return { inQuietHours: false };
  const minutesLeft = (end - minute + 1440) % 1440;
  // +1s so the delayed job lands just after the window closes.
  const delayMs = Math.max(1000, minutesLeft * 60_000 - c.second * 1000 + 1000);
  return { inQuietHours: true, delayMs, resumeAt: new Date(now.getTime() + delayMs) };
}

/** Start of the member's current local day, as an instant (used for the daily cap). */
export function localDayStart(now: Date, timezone: string): Date {
  const c = localClock(now, timezone);
  return new Date(now.getTime() - ((c.hour * 60 + c.minute) * 60 + c.second) * 1000);
}

/** Error text kept in the delivery log: no addresses, no phone numbers, bounded length. */
export function summariseError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  return raw
    .replace(/[^\s@<>"']+@[^\s@<>"']+/g, "[email]")
    .replace(/\+?\d[\d\s-]{7,}\d/g, "[number]")
    .slice(0, 200);
}
