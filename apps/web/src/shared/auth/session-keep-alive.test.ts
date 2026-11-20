import { describe, expect, it } from "vitest";
import { KeepAlive, KEEP_ALIVE_INTERVAL_MS as I } from "./session-keep-alive";

function setup(opts: { refresh?: () => Promise<boolean>; shouldRun?: boolean } = {}) {
  let clock = 0;
  let visible = true;
  let shouldRun = opts.shouldRun ?? true;
  const timers = new Map<number, { at: number; fn: () => void }>();
  let nextId = 1;
  let calls = 0;
  const refresh = opts.refresh ?? (async () => true);
  const ka = new KeepAlive({
    refresh: () => {
      calls++;
      return refresh();
    },
    shouldRun: () => shouldRun,
    isVisible: () => visible,
    now: () => clock,
    setTimer: (fn, ms) => {
      const id = nextId++;
      timers.set(id, { at: clock + ms, fn });
      return id;
    },
    clearTimer: (h) => void timers.delete(h as number),
    random: () => 0.5,
    jitterMs: 60_000,
  });
  const advance = async (ms: number) => {
    const target = clock + ms;
    for (;;) {
      const due = [...timers.entries()].filter(([, t]) => t.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      timers.delete(due[0]);
      clock = due[1].at;
      due[1].fn();
      await Promise.resolve();
      await Promise.resolve();
    }
    clock = target;
  };
  return {
    ka,
    advance,
    calls: () => calls,
    pending: () => timers.size,
    setVisible: (v: boolean) => {
      visible = v;
      ka.onVisibilityChange();
    },
    setShouldRun: (v: boolean) => (shouldRun = v),
  };
}

describe("KeepAlive", () => {
  it("refreshes about every 10 minutes (plus jitter) while visible", async () => {
    const s = setup();
    s.ka.start();
    await s.advance(I - 1);
    expect(s.calls()).toBe(0);
    await s.advance(31_000); // 10 min + 30 s jitter
    expect(s.calls()).toBe(1);
    await s.advance(I + 30_000);
    expect(s.calls()).toBe(2);
  });

  it("does not refresh while hidden and refreshes on return after more than 10 minutes", async () => {
    const s = setup();
    s.ka.start();
    s.setVisible(false);
    expect(s.pending()).toBe(0);
    await s.advance(3 * I);
    expect(s.calls()).toBe(0);
    s.setVisible(true);
    await Promise.resolve();
    expect(s.calls()).toBe(1);
  });

  it("returning to a tab hidden for less than 10 minutes just reschedules", async () => {
    const s = setup();
    s.ka.start();
    await s.advance(3 * 60_000);
    s.setVisible(false);
    await s.advance(2 * 60_000);
    s.setVisible(true);
    expect(s.calls()).toBe(0);
    expect(s.pending()).toBe(1);
  });

  it("never runs two refreshes at once", async () => {
    let release: (v: boolean) => void = () => {};
    const s = setup({ refresh: () => new Promise<boolean>((r) => (release = r)) });
    s.ka.start();
    await s.advance(I + 60_000);
    expect(s.calls()).toBe(1);
    s.setVisible(false);
    s.setVisible(true); // idle >= interval would trigger again, but one is in flight
    await Promise.resolve();
    expect(s.calls()).toBe(1);
    release(true);
  });

  it("waits a full interval after a failure instead of retrying", async () => {
    const s = setup({ refresh: async () => false });
    s.ka.start();
    await s.advance(I + 60_000);
    expect(s.calls()).toBe(1);
    await s.advance(I - 60_000);
    expect(s.calls()).toBe(1);
    await s.advance(2 * 60_000);
    expect(s.calls()).toBe(2);
  });

  it("swallows a thrown refresh and keeps scheduling", async () => {
    const s = setup({
      refresh: async () => {
        throw new Error("network");
      },
    });
    s.ka.start();
    await s.advance(I + 60_000);
    expect(s.calls()).toBe(1);
    expect(s.pending()).toBe(1);
  });

  it("makes no refresh while signed out but keeps checking", async () => {
    const s = setup({ shouldRun: false });
    s.ka.start();
    await s.advance(I + 60_000);
    expect(s.calls()).toBe(0);
    s.setShouldRun(true);
    await s.advance(I + 60_000);
    expect(s.calls()).toBe(1);
  });

  it("stop cancels everything", async () => {
    const s = setup();
    s.ka.start();
    s.ka.stop();
    await s.advance(5 * I);
    expect(s.calls()).toBe(0);
  });
});
