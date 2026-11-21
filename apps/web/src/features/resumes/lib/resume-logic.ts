import { RESUME_MAX_BYTES, RESUME_CONTENT_TYPES } from "@packetpulse/types";
import type { ResumeSuggestionView, ResumeView } from "@packetpulse/types";
import type { StatusTone } from "@/shared/ui/primitives/StatusChip";

// Pure helpers for the resume screens (SCR-012, TASK-024): wording, states and file checks are
// tested without rendering. Dates are shown in IST like the other member screens.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2019-01" -> "Jan 2019", "2019" -> "2019", anything else -> "". */
export function formatMonth(value: string | null | undefined): string {
  if (!value) return "";
  const m = /^(\d{4})(?:-(\d{2}))?$/.exec(value);
  if (!m) return "";
  const month = m[2] ? MONTHS[Number(m[2]) - 1] : undefined;
  return month ? `${month} ${m[1]}` : m[2] ? "" : m[1]!;
}

const dateTime = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });
export function formatUploaded(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : `${dateTime.format(d)} IST`;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

const BY_EXTENSION: Record<string, (typeof RESUME_CONTENT_TYPES)[number]> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

/** The content type to send, or null when the file is not a PDF or DOCX. The extension decides when the browser gives no type. */
export function resumeContentType(file: { name: string; type: string }): (typeof RESUME_CONTENT_TYPES)[number] | null {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const byExt = BY_EXTENSION[ext];
  if (!byExt) return null;
  if (file.type && file.type !== "application/octet-stream" && file.type !== byExt) return null;
  return byExt;
}

/** A plain sentence when the file cannot be uploaded, or null. Checked before anything is sent. */
export function validateResumeFile(file: { name: string; type: string; size: number }): string | null {
  if (/\.doc$/i.test(file.name)) return "Older Word files (.doc) are not accepted. Open it in Word and save it as .docx or PDF, then try again.";
  if (!resumeContentType(file)) return "Choose a PDF or a Word (.docx) file.";
  if (file.size <= 0) return "That file is empty. Choose another one.";
  if (file.size > RESUME_MAX_BYTES) return `That file is ${formatBytes(file.size)}. The limit is ${formatBytes(RESUME_MAX_BYTES)}. Try a smaller version.`;
  return null;
}

export type UploadPhase =
  | { kind: "idle" }
  | { kind: "uploading"; name: string; percent: number }
  | { kind: "scanning"; name: string };

export interface ResumeState {
  tone: StatusTone;
  label: string;
  /** One sentence for the member. */
  text: string;
}

// The server states of a resume in the member's words.
export function resumeState(r: ResumeView): ResumeState {
  switch (r.status) {
    case "awaiting_upload":
      return { tone: "information", label: "Waiting for the file", text: "The upload has not finished yet." };
    case "parsing":
      return { tone: "information", label: "Reading", text: "We are reading your resume. This usually takes a few seconds. You can leave this page." };
    case "ready":
      return { tone: "success", label: "Ready to review", text: "We read your resume. Nothing is added to your profile until you accept it below." };
    case "failed":
      return { tone: "warning", label: "Could not read", text: r.failureMessage ?? "We could not read your resume. You can enter your details by hand." };
    case "rejected":
      return { tone: "danger", label: "Not accepted", text: r.failureMessage ?? "This file was not accepted." };
  }
}

export interface StepView {
  id: "upload" | "scan" | "read" | "review";
  label: string;
  state: "done" | "current" | "todo" | "failed";
}

// The four steps (uploading, scanning, parsing, ready/failed) as one list, so progress is text and
// order, never colour alone.
export function resumeSteps(phase: UploadPhase, current: ResumeView | null): StepView[] {
  const s = (id: StepView["id"], label: string, state: StepView["state"]): StepView => ({ id, label, state });
  if (phase.kind === "uploading") return [s("upload", "Upload", "current"), s("scan", "Check", "todo"), s("read", "Read", "todo"), s("review", "Review", "todo")];
  if (phase.kind === "scanning") return [s("upload", "Upload", "done"), s("scan", "Check", "current"), s("read", "Read", "todo"), s("review", "Review", "todo")];
  if (!current) return [s("upload", "Upload", "todo"), s("scan", "Check", "todo"), s("read", "Read", "todo"), s("review", "Review", "todo")];
  switch (current.status) {
    case "parsing":
      return [s("upload", "Upload", "done"), s("scan", "Check", "done"), s("read", "Read", "current"), s("review", "Review", "todo")];
    case "ready":
      return [s("upload", "Upload", "done"), s("scan", "Check", "done"), s("read", "Read", "done"), s("review", "Review", "current")];
    case "failed":
      return [s("upload", "Upload", "done"), s("scan", "Check", "done"), s("read", "Read", "failed"), s("review", "Review", "todo")];
    case "rejected":
      return [s("upload", "Upload", "done"), s("scan", "Check", "failed"), s("read", "Read", "todo"), s("review", "Review", "todo")];
    default:
      return [s("upload", "Upload", "current"), s("scan", "Check", "todo"), s("read", "Read", "todo"), s("review", "Review", "todo")];
  }
}

export const STEP_STATE_TEXT: Record<StepView["state"], string> = { done: "done", current: "in progress", todo: "not started", failed: "stopped" };

// ---------------------------------------------------------------------------- suggestions

function rangeText(start: string | number | null, end: string | number | null, current: boolean): string {
  const a = typeof start === "number" ? String(start) : formatMonth(start);
  const b = current ? "present" : typeof end === "number" ? String(end) : formatMonth(end);
  if (a && b) return `${a} to ${b}`;
  return a || b || "";
}

/** The headline and the detail of one suggestion, as the member reads them. */
export function describeSuggestion(s: ResumeSuggestionView): { title: string; detail: string } {
  if (s.kind === "skill") {
    const found = s.data.matchedOn && s.data.matchedOn.toLowerCase() !== s.data.name.toLowerCase() ? `Found as "${s.data.matchedOn}"` : "";
    return { title: s.data.name, detail: found };
  }
  if (s.kind === "education") {
    const d = s.data;
    return { title: d.qualification ?? d.institution ?? "Education", detail: [d.qualification ? d.institution : null, rangeText(d.startYear, d.endYear, false)].filter(Boolean).join(" · ") };
  }
  const d = s.data;
  const title = d.title && d.company ? `${d.title} at ${d.company}` : (d.title ?? d.company ?? "Experience");
  return { title, detail: rangeText(d.startDate, d.endDate, d.current) };
}

export const KIND_HEADINGS = { skill: "Skills", education: "Education", experience: "Experience" } as const;

export function groupSuggestions(list: ResumeSuggestionView[]) {
  return {
    skill: list.filter((s) => s.kind === "skill"),
    education: list.filter((s) => s.kind === "education"),
    experience: list.filter((s) => s.kind === "experience"),
  };
}

export const pendingCount = (list: ResumeSuggestionView[]) => list.filter((s) => s.status === "pending").length;
