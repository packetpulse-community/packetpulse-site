import { describe, expect, it } from "vitest";
import type { ResumeSuggestionView, ResumeView } from "@packetpulse/types";
import { RESUME_FAILURE_MESSAGES } from "@packetpulse/types";
import { describeSuggestion, formatBytes, formatMonth, groupSuggestions, pendingCount, resumeContentType, resumeState, resumeSteps, validateResumeFile } from "./resume-logic";

const PDF = { name: "cv.pdf", type: "application/pdf", size: 1000 };
const DOCX = { name: "cv.docx", type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size: 1000 };

const resume = (over: Partial<ResumeView> = {}): ResumeView => ({
  id: "r1",
  version: 1,
  fileId: "f1",
  originalName: "cv.pdf",
  contentType: "application/pdf",
  sizeBytes: 1000,
  status: "ready",
  failureCode: null,
  failureMessage: null,
  retryable: false,
  isCurrent: true,
  visibility: "private",
  createdAt: "2026-11-21T10:00:00.000Z",
  parsedAt: null,
  ...over,
});

describe("file checks before upload", () => {
  it("accepts a PDF and a DOCX, with or without a browser-provided type", () => {
    expect(validateResumeFile(PDF)).toBeNull();
    expect(validateResumeFile(DOCX)).toBeNull();
    expect(validateResumeFile({ ...PDF, type: "" })).toBeNull();
    expect(resumeContentType({ name: "CV.PDF", type: "" })).toBe("application/pdf");
  });

  it("refuses other types in plain words, and tells a .doc user what to do", () => {
    expect(validateResumeFile({ ...PDF, name: "cv.png", type: "image/png" })).toBe("Choose a PDF or a Word (.docx) file.");
    expect(validateResumeFile({ ...PDF, name: "cv.exe", type: "application/x-msdownload" })).toContain("PDF or a Word");
    expect(validateResumeFile({ name: "cv.doc", type: "application/msword", size: 100 })).toContain("save it as .docx or PDF");
    // A name that says pdf but a type that says otherwise is not trusted.
    expect(validateResumeFile({ name: "cv.pdf", type: "image/png", size: 100 })).not.toBeNull();
  });

  it("refuses an empty file and a file over 5 MB, naming the size", () => {
    expect(validateResumeFile({ ...PDF, size: 0 })).toContain("empty");
    expect(validateResumeFile({ ...PDF, size: 5 * 1024 * 1024 })).toBeNull();
    const big = validateResumeFile({ ...PDF, size: 7 * 1024 * 1024 });
    expect(big).toContain("7.0 MB");
    expect(big).toContain("5.0 MB");
  });

  it("formats sizes", () => {
    expect([formatBytes(500), formatBytes(2048), formatBytes(3 * 1024 * 1024)]).toEqual(["500 B", "2 KB", "3.0 MB"]);
  });
});

describe("states in the member's words", () => {
  it("has a label and a sentence for every server state", () => {
    for (const status of ["awaiting_upload", "parsing", "ready", "failed", "rejected"] as const) {
      const s = resumeState(resume({ status }));
      expect(s.label.length).toBeGreaterThan(3);
      expect(s.text.length).toBeGreaterThan(15);
    }
  });

  it("shows the server's plain message for a failure, and never a technical word", () => {
    const failed = resumeState(resume({ status: "failed", failureCode: "no_text", failureMessage: RESUME_FAILURE_MESSAGES.no_text }));
    expect(failed.text).toContain("scan");
    expect(failed.text).toContain("by hand");
    for (const m of Object.values(RESUME_FAILURE_MESSAGES)) expect(m).not.toMatch(/exception|stack|worker|timeout error|null|undefined|500/i);
  });

  it("walks the four steps in order", () => {
    const names = (steps: ReturnType<typeof resumeSteps>) => steps.map((s) => `${s.id}:${s.state}`).join(" ");
    expect(names(resumeSteps({ kind: "uploading", name: "x", percent: 10 }, null))).toBe("upload:current scan:todo read:todo review:todo");
    expect(names(resumeSteps({ kind: "scanning", name: "x" }, null))).toBe("upload:done scan:current read:todo review:todo");
    expect(names(resumeSteps({ kind: "idle" }, resume({ status: "parsing" })))).toBe("upload:done scan:done read:current review:todo");
    expect(names(resumeSteps({ kind: "idle" }, resume({ status: "ready" })))).toBe("upload:done scan:done read:done review:current");
    expect(names(resumeSteps({ kind: "idle" }, resume({ status: "failed" })))).toBe("upload:done scan:done read:failed review:todo");
    expect(names(resumeSteps({ kind: "idle" }, resume({ status: "rejected" })))).toBe("upload:done scan:failed read:todo review:todo");
    expect(names(resumeSteps({ kind: "idle" }, null))).toBe("upload:todo scan:todo read:todo review:todo");
  });
});

describe("suggestions", () => {
  const skill: ResumeSuggestionView = { id: "1", kind: "skill", status: "pending", decidedAt: null, data: { skillId: "s", name: "OSPF", matchedOn: "Open Shortest Path First" } };
  const edu: ResumeSuggestionView = { id: "2", kind: "education", status: "accepted", decidedAt: null, data: { institution: "Example Institute", qualification: "B.Tech", startYear: 2011, endYear: 2015 } };
  const exp: ResumeSuggestionView = { id: "3", kind: "experience", status: "rejected", decidedAt: null, data: { title: "Engineer", company: "Acme", startDate: "2019-01", endDate: null, current: true } };

  it("describes each kind", () => {
    expect(describeSuggestion(skill)).toEqual({ title: "OSPF", detail: 'Found as "Open Shortest Path First"' });
    expect(describeSuggestion({ ...skill, data: { ...skill.data, matchedOn: "ospf" } } as ResumeSuggestionView).detail).toBe("");
    expect(describeSuggestion(edu)).toEqual({ title: "B.Tech", detail: "Example Institute · 2011 to 2015" });
    expect(describeSuggestion(exp)).toEqual({ title: "Engineer at Acme", detail: "Jan 2019 to present" });
  });

  it("copes with missing fields", () => {
    const sparse = { id: "4", kind: "experience", status: "pending", decidedAt: null, data: { title: null, company: "Acme", startDate: "2015", endDate: "2016-06", current: false } } as ResumeSuggestionView;
    expect(describeSuggestion(sparse)).toEqual({ title: "Acme", detail: "2015 to Jun 2016" });
  });

  it("groups and counts", () => {
    const g = groupSuggestions([skill, edu, exp]);
    expect([g.skill.length, g.education.length, g.experience.length]).toEqual([1, 1, 1]);
    expect(pendingCount([skill, edu, exp])).toBe(1);
  });

  it("formats months and years, and ignores junk", () => {
    expect([formatMonth("2019-01"), formatMonth("2019"), formatMonth("2019-13"), formatMonth("x"), formatMonth(null)]).toEqual(["Jan 2019", "2019", "", "", ""]);
  });
});
