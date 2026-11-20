import { describe, expect, it } from "vitest";
import { clockOffsetMs, describeBlock, formatClock, remainingSeconds } from "./attempt-timer";

describe("attempt timer", () => {
  it("counts down against the server clock, not the device clock", () => {
    // Device clock is 1 hour ahead of the server.
    const serverNow = "2026-01-01T10:00:00.000Z";
    const clientNow = new Date("2026-01-01T11:00:00.000Z").getTime();
    const offset = clockOffsetMs(serverNow, clientNow);
    expect(offset).toBe(-3_600_000);
    // 5 minutes after the server's now, the deadline is 10:10 -> 5 minutes left.
    const later = clientNow + 5 * 60_000;
    expect(remainingSeconds("2026-01-01T10:10:00.000Z", offset, later)).toBe(300);
  });

  it("never goes below zero and rounds up partial seconds", () => {
    expect(remainingSeconds("2026-01-01T10:00:00.000Z", 0, new Date("2026-01-01T10:00:05.000Z").getTime())).toBe(0);
    expect(remainingSeconds("2026-01-01T10:00:01.200Z", 0, new Date("2026-01-01T10:00:00.000Z").getTime())).toBe(2);
  });

  it("returns null for an untimed attempt", () => {
    expect(remainingSeconds(null, 0, Date.now())).toBeNull();
  });

  it("formats clocks", () => {
    expect(formatClock(65)).toBe("1:05");
    expect(formatClock(3725)).toBe("1:02:05");
  });

  it("explains why a start is blocked", () => {
    expect(describeBlock("limit_reached", null)).toMatch(/all your attempts/);
    expect(describeBlock("quiz_expired", null)).toMatch(/closed/);
    expect(describeBlock("retake_gap", "2026-01-01T10:00:00.000Z")).toMatch(/retake/);
    expect(describeBlock(null, null)).toBeNull();
  });
});
