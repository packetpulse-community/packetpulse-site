// The attempt countdown is driven by the server's clock, never the browser's: the
// browser only measures how far its own clock is from the server's at the moment it
// received `serverNow`, and applies that offset. Changing the device clock mid-attempt
// therefore does not stretch the time, and the server still enforces the deadline.

export function clockOffsetMs(serverNowIso: string, clientNowMs: number): number {
  return new Date(serverNowIso).getTime() - clientNowMs;
}

// Whole seconds left (rounded up so "0:01" is shown until the very end), or null when
// the attempt has no deadline.
export function remainingSeconds(deadlineIso: string | null, offsetMs: number, clientNowMs: number): number | null {
  if (!deadlineIso) return null;
  const left = new Date(deadlineIso).getTime() - (clientNowMs + offsetMs);
  return Math.max(0, Math.ceil(left / 1000));
}

export function formatClock(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const ss = s.toString().padStart(2, "0");
  return h > 0 ? `${h}:${m.toString().padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

export function describeBlock(reason: string | null, nextAttemptAt: string | null): string | null {
  switch (reason) {
    case "limit_reached":
      return "You have used all your attempts for this quiz.";
    case "retake_gap":
      return nextAttemptAt ? `You can retake this quiz after ${new Date(nextAttemptAt).toLocaleString()}.` : "Please wait before retaking this quiz.";
    case "quiz_expired":
      return "This quiz has closed and no longer accepts attempts.";
    case "quiz_archived":
      return "This quiz has been retired and no longer accepts attempts.";
    default:
      return null;
  }
}

// <input type="datetime-local"> wants "YYYY-MM-DDTHH:mm" in the viewer's local time.
export function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
