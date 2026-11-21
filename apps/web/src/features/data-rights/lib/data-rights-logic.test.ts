import { describe, expect, it } from "vitest";
import type { DataRequestView } from "@packetpulse/types";
import { RETENTION_RULES } from "@packetpulse/types";
import { adminTone, erasureIsScheduled, erasureState, exportIsOpen, exportIsWorking, exportState, formatDate, periodText } from "./data-rights-logic";

const base: DataRequestView = {
  id: "r1",
  kind: "export",
  status: "requested",
  requestedAt: "2026-11-01T10:00:00.000Z",
  scheduledFor: null,
  readyAt: null,
  expiresAt: null,
  completedAt: null,
  cancelledAt: null,
};
const req = (over: Partial<DataRequestView>): DataRequestView => ({ ...base, ...over });

describe("export states", () => {
  it("has a distinct label and tone for each state, never colour alone", () => {
    const labels = (["requested", "preparing", "ready", "expired", "cancelled", "failed"] as const).map((s) => exportState(req({ status: s, expiresAt: "2026-11-08T10:00:00.000Z" }), 7).label);
    expect(new Set(labels).size).toBe(labels.length);
    expect(exportState(null, 7).label).toBe("No export yet");
    expect(exportState(req({ status: "failed" }), 7).tone).toBe("danger");
    expect(exportState(req({ status: "ready", expiresAt: "2026-11-08T10:00:00.000Z" }), 7).tone).toBe("success");
  });

  it("says when a ready export runs out and how long it was kept", () => {
    expect(exportState(req({ status: "ready", expiresAt: "2026-11-08T10:00:00.000Z" }), 7).text).toContain("8 Nov 2026");
    expect(exportState(req({ status: "expired" }), 7).text).toContain("7 days");
  });

  it("knows which states block a new request and which are still working", () => {
    expect(exportIsOpen(req({ status: "ready" }))).toBe(true);
    expect(exportIsOpen(req({ status: "expired" }))).toBe(false);
    expect(exportIsOpen(null)).toBe(false);
    expect(exportIsWorking(req({ status: "preparing" }))).toBe(true);
    expect(exportIsWorking(req({ status: "ready" }))).toBe(false);
  });
});

describe("erasure states", () => {
  it("names the date the account will be deleted", () => {
    const s = erasureState(req({ kind: "erasure", status: "scheduled", scheduledFor: "2026-12-01T10:00:00.000Z" }), 30);
    expect(s.tone).toBe("warning");
    expect(s.text).toContain("1 Dec 2026");
    expect(erasureIsScheduled(req({ status: "scheduled" }))).toBe(true);
  });

  it("explains the grace period before anything is requested and after a cancel", () => {
    expect(erasureState(null, 30).text).toContain("30-day");
    expect(erasureState(req({ kind: "erasure", status: "cancelled", cancelledAt: "2026-11-05T10:00:00.000Z" }), 30).text).toContain("5 Nov 2026");
  });
});

describe("formatting", () => {
  it("shows dates in IST and tolerates bad input", () => {
    expect(formatDate("2026-11-30T20:00:00.000Z")).toBe("1 Dec 2026"); // 01:30 IST next day
    expect(formatDate(null)).toBe("");
    expect(formatDate("not a date")).toBe("");
  });

  it("describes every retention rule", () => {
    for (const r of RETENTION_RULES) expect(periodText(r).length).toBeGreaterThan(3);
    expect(periodText({ days: 1095, from: "erasure" })).toBe("3 years after erasure");
    expect(periodText({ days: 90, from: "creation" })).toBe("90 days after creation");
    expect(periodText({ days: null, from: "x" })).toBe("No automatic limit");
  });

  it("maps admin statuses to tones", () => {
    expect(adminTone("failed")).toBe("danger");
    expect(adminTone("scheduled")).toBe("warning");
    expect(adminTone("expired")).toBe("neutral");
  });
});
