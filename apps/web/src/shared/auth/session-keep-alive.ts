// Scheduling for SessionKeepAlive: renews the session quietly while a tab is visible, so the
// 15-minute access cookie does not lapse under someone who is still reading. Pure logic with an
// injectable clock, timers and refresh function so it can be tested without a browser or network.

export const KEEP_ALIVE_INTERVAL_MS = 10 * 60 * 1000;
export const KEEP_ALIVE_JITTER_MS = 60 * 1000;

export interface KeepAliveDeps {
  refresh: () => Promise<boolean>;
  // False when there is nothing to renew (signed out): the tick then does nothing and waits a full interval.
  shouldRun: () => boolean;
  isVisible: () => boolean;
  now: () => number;
  setTimer: (fn: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
  random?: () => number;
  intervalMs?: number;
  jitterMs?: number;
}

export class KeepAlive {
  private timer: unknown = null;
  private inFlight = false;
  private lastAttempt: number;
  private started = false;
  private readonly interval: number;
  private readonly jitter: number;
  private readonly random: () => number;

  constructor(private readonly deps: KeepAliveDeps) {
    this.interval = deps.intervalMs ?? KEEP_ALIVE_INTERVAL_MS;
    this.jitter = deps.jitterMs ?? KEEP_ALIVE_JITTER_MS;
    this.random = deps.random ?? Math.random;
    this.lastAttempt = deps.now();
  }

  start() {
    this.started = true;
    this.lastAttempt = this.deps.now();
    if (this.deps.isVisible()) this.schedule(this.interval);
  }

  stop() {
    this.started = false;
    this.cancel();
  }

  // Call from the document's visibilitychange event.
  onVisibilityChange() {
    if (!this.started) return;
    if (!this.deps.isVisible()) {
      this.cancel(); // hidden tabs never refresh
      return;
    }
    const idle = this.deps.now() - this.lastAttempt;
    if (idle >= this.interval) void this.run();
    else this.schedule(this.interval - idle);
  }

  private cancel() {
    if (this.timer !== null) this.deps.clearTimer(this.timer);
    this.timer = null;
  }

  private schedule(baseMs: number) {
    this.cancel();
    this.timer = this.deps.setTimer(() => void this.run(), baseMs + this.random() * this.jitter);
  }

  private async run() {
    this.timer = null;
    if (this.inFlight) return;
    if (!this.started || !this.deps.isVisible()) return;
    if (this.deps.shouldRun()) {
      this.inFlight = true;
      this.lastAttempt = this.deps.now();
      try {
        await this.deps.refresh();
      } catch {
        // Nothing visible: the next navigation handles an expired session.
      } finally {
        this.inFlight = false;
      }
    } else {
      this.lastAttempt = this.deps.now();
    }
    // One timer per attempt, a full interval apart (success or failure), so there is no retry loop.
    if (this.started && this.deps.isVisible() && this.timer === null) this.schedule(this.interval);
  }
}
