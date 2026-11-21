// @vitest-environment jsdom
// Component-level axe scan of the resume screens (TASK-024 / TASK-050), every state.
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProfileEntries, ResumeSuggestionView, ResumeView } from "@packetpulse/types";
import { RESUME_FAILURE_MESSAGES } from "@packetpulse/types";
import { expectNoViolations, render, type Rendered } from "@/test/axe";
import { CurrentResume } from "./CurrentResume";
import { DeleteResumeDialog } from "./DeleteResumeDialog";
import { EarlierVersions } from "./EarlierVersions";
import { ProfileEntriesPanel } from "./ProfileEntriesPanel";
import { ResumeSteps } from "./ResumeSteps";
import { SuggestionReview } from "./SuggestionReview";
import { UploadPanel } from "./UploadPanel";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

let mounted: Rendered | undefined;
afterEach(() => {
  mounted?.unmount();
  mounted = undefined;
  document.body.innerHTML = "";
});

const noop = () => undefined;
const resume = (over: Partial<ResumeView> = {}): ResumeView => ({
  id: "r1",
  version: 2,
  fileId: "f1",
  originalName: "My CV.pdf",
  contentType: "application/pdf",
  sizeBytes: 123_456,
  status: "ready",
  failureCode: null,
  failureMessage: null,
  retryable: false,
  isCurrent: true,
  visibility: "private",
  createdAt: "2026-11-21T10:00:00.000Z",
  parsedAt: "2026-11-21T10:00:05.000Z",
  ...over,
});

async function check(ui: React.ReactElement) {
  mounted = await render(
    <main data-theme="grove">
      <h1>Your resume</h1>
      <h2>Section</h2>
      {ui}
    </main>,
  );
  await expectNoViolations(document.body);
  return document.body;
}
const buttons = (body: HTMLElement) => [...body.querySelectorAll("button")].map((b) => b.textContent?.trim());

describe("steps", () => {
  it.each([
    ["uploading", { kind: "uploading", name: "cv.pdf", percent: 40 } as const, null],
    ["scanning", { kind: "scanning", name: "cv.pdf" } as const, null],
    ["parsing", { kind: "idle" } as const, resume({ status: "parsing" })],
    ["ready", { kind: "idle" } as const, resume()],
    ["failed", { kind: "idle" } as const, resume({ status: "failed" })],
    ["rejected", { kind: "idle" } as const, resume({ status: "rejected" })],
  ])("%s has no violations and names each step's state in words", async (_n, phase, current) => {
    const body = await check(<ResumeSteps phase={phase} current={current} />);
    expect(body.querySelectorAll("li")).toHaveLength(4);
    expect(body.textContent).toMatch(/\((done|in progress|not started|stopped)\)/);
  });
});

describe("upload panel", () => {
  const base = { phase: { kind: "idle" } as const, error: null, enabled: true, consentGranted: true, hasCurrent: false, agreeing: false, consentError: null, onFile: noop, onCancel: noop, onAgree: noop };

  it("idle: one button to choose a file, the limits in words, and a labelled file input", async () => {
    const body = await check(<UploadPanel {...base} />);
    expect(buttons(body)).toEqual(["Choose a resume"]);
    expect(body.textContent).toContain("PDF or Word (.docx), up to 5.0 MB");
    expect(body.querySelector('input[type="file"]')?.getAttribute("accept")).toContain(".pdf");
  });

  it("with a resume already stored the button says replace", async () => {
    const body = await check(<UploadPanel {...base} hasCurrent />);
    expect(buttons(body)).toEqual(["Replace my resume"]);
  });

  it("uploading: a labelled progress bar with a percentage in words, and a way to cancel", async () => {
    const body = await check(<UploadPanel {...base} phase={{ kind: "uploading", name: "cv.pdf", percent: 42 }} />);
    const bar = body.querySelector("progress")!;
    expect(bar.getAttribute("aria-label")).toBe("Uploading cv.pdf");
    expect(bar.value).toBe(42);
    expect(body.querySelector('[role="status"]')?.textContent).toContain("42%");
    expect(buttons(body)).toEqual(["Cancel upload"]);
  });

  it("scanning: says what is happening", async () => {
    const body = await check(<UploadPanel {...base} phase={{ kind: "scanning", name: "cv.pdf" }} />);
    expect(body.querySelector('[role="status"]')?.textContent).toContain("Checking");
    expect(body.querySelector("button")).toBeNull();
  });

  it("an inline error is an alert and is tied to the button", async () => {
    const body = await check(<UploadPanel {...base} error="That file is 7.0 MB. The limit is 5.0 MB. Try a smaller version." />);
    expect(body.querySelector('[role="alert"]')?.textContent).toContain("7.0 MB");
    const button = body.querySelector("button")!;
    expect(body.querySelector(`#${button.getAttribute("aria-describedby")}`)?.getAttribute("role")).toBe("alert");
  });

  it("without consent it asks first and offers no file picker", async () => {
    const body = await check(<UploadPanel {...base} consentGranted={false} consentError="We could not save your choice. Please try again." />);
    expect(buttons(body)).toEqual(["I agree, continue"]);
    expect(body.querySelector('input[type="file"]')).toBeNull();
    expect(body.textContent).toContain("withdraw this at any time");
    expect(body.querySelector('[role="alert"]')?.textContent).toContain("could not save");
  });

  it("with the switch off shows the off state and no upload control", async () => {
    const body = await check(<UploadPanel {...base} enabled={false} />);
    expect(body.textContent).toContain("Resume upload is switched off for now");
    expect(body.querySelector('input[type="file"]')).toBeNull();
    expect(body.textContent).toContain("you can still open or delete them");
  });
});

describe("current resume", () => {
  const props = { busy: null, canRetry: true, error: null, onOpen: noop, onRetry: noop, onDelete: noop } as const;

  it.each([
    ["parsing", resume({ status: "parsing" })],
    ["ready", resume()],
    ["failed (retryable)", resume({ status: "failed", failureCode: "timeout", failureMessage: RESUME_FAILURE_MESSAGES.timeout, retryable: true })],
    ["failed (not retryable)", resume({ status: "failed", failureCode: "no_text", failureMessage: RESUME_FAILURE_MESSAGES.no_text })],
    ["rejected", resume({ status: "rejected", failureCode: "unsafe_content", failureMessage: RESUME_FAILURE_MESSAGES.unsafe_content })],
  ])("%s has no violations and a live status in words", async (_n, r) => {
    const body = await check(<CurrentResume {...props} resume={r} />);
    expect(body.querySelector('[role="status"]')?.textContent?.length).toBeGreaterThan(20);
    expect(body.textContent).toContain("private to you");
  });

  it("offers the right buttons per state", async () => {
    const ready = await check(<CurrentResume {...props} resume={resume()} />);
    expect(buttons(ready)).toEqual(["Open my resume", "Delete my resume"]);
    mounted?.unmount();
    const retry = await check(<CurrentResume {...props} resume={resume({ status: "failed", failureCode: "timeout", retryable: true })} />);
    expect(buttons(retry)).toContain("Read it again");
    mounted?.unmount();
    const off = await check(<CurrentResume {...props} canRetry={false} resume={resume({ status: "failed", failureCode: "timeout", retryable: true })} />);
    expect(buttons(off)).not.toContain("Read it again");
    mounted?.unmount();
    const rejected = await check(<CurrentResume {...props} resume={resume({ status: "rejected", failureCode: "unsafe_content" })} />);
    expect(buttons(rejected)).toEqual(["Delete my resume"]); // the file is gone, nothing to open
  });

  it("a failure tells the member that entering details by hand still works", async () => {
    const body = await check(<CurrentResume {...props} resume={resume({ status: "failed", failureCode: "unreadable", failureMessage: RESUME_FAILURE_MESSAGES.unreadable })} />);
    expect(body.textContent).toContain("enter your details by hand");
  });

  it("shows an inline error as an alert", async () => {
    const body = await check(<CurrentResume {...props} resume={resume()} error="We could not open that file. Please try again." />);
    expect(body.querySelector('[role="alert"]')?.textContent).toContain("could not open");
  });
});

describe("suggestion review", () => {
  const skill = (id: string, status: ResumeSuggestionView["status"], name = "OSPF"): ResumeSuggestionView => ({ id, kind: "skill", status, decidedAt: null, data: { skillId: id, name, matchedOn: name } });
  const list: ResumeSuggestionView[] = [
    skill("1", "pending", "OSPF"),
    skill("2", "accepted", "BGP"),
    skill("3", "rejected", "Python"),
    { id: "4", kind: "education", status: "pending", decidedAt: null, data: { institution: "Example Institute", qualification: "B.Tech", startYear: 2011, endYear: 2015 } },
    { id: "5", kind: "experience", status: "pending", decidedAt: null, data: { title: "Engineer", company: "Acme", startDate: "2019-01", endDate: null, current: true } },
  ];
  const props = { busyId: null, errors: {}, onDecide: noop } as const;

  it("lists every kind with grouped headings and no violations", async () => {
    const body = await check(<SuggestionReview {...props} suggestions={list} />);
    expect([...body.querySelectorAll("h3")].map((h) => h.textContent)).toEqual(["Skills", "Education", "Experience"]);
    expect(body.textContent).toContain("3 suggestions are waiting for you");
    expect(body.textContent).toContain("Nothing is added to your profile until you accept it");
  });

  it("each button names the value it acts on, and decided rows say so in words", async () => {
    const body = await check(<SuggestionReview {...props} suggestions={list} />);
    const labels = [...body.querySelectorAll("button")].map((b) => b.getAttribute("aria-label"));
    expect(labels).toEqual(expect.arrayContaining(["Accept OSPF", "Reject OSPF", "Accept B.Tech", "Reject Engineer at Acme"]));
    expect(labels).not.toContain("Accept BGP"); // already on the profile
    expect(labels).not.toContain("Reject Python"); // already declined, can still be accepted
    expect(labels).toContain("Accept Python");
    expect(body.textContent).toContain("On your profile");
    expect(body.textContent).toContain("Not added");
  });

  it("an error sits under the row it belongs to and is tied to its button", async () => {
    const body = await check(<SuggestionReview {...props} suggestions={list} errors={{ "1": "You already have 25 skills on your profile." }} />);
    expect(body.querySelector('[role="alert"]')?.textContent).toContain("25 skills");
    const accept = body.querySelector('button[aria-label="Accept OSPF"]')!;
    expect(body.querySelector(`#${accept.getAttribute("aria-describedby")}`)?.textContent).toContain("25 skills");
  });

  it("while one is saving the others are not clickable", async () => {
    const body = await check(<SuggestionReview {...props} suggestions={list} busyId="1" />);
    expect(body.querySelector('button[aria-label="Accept B.Tech"]')?.hasAttribute("disabled")).toBe(true);
  });

  it("everything reviewed and nothing found are said in words", async () => {
    const done = await check(<SuggestionReview {...props} suggestions={[skill("2", "accepted", "BGP")]} />);
    expect(done.textContent).toContain("You have reviewed everything we found");
    mounted?.unmount();
    const none = await check(<SuggestionReview {...props} suggestions={[]} />);
    expect(none.textContent).toContain("add your skills and details by hand");
  });
});

describe("profile entries, history and delete", () => {
  const entries: ProfileEntries = {
    education: [{ id: "e1", institution: "Example Institute", qualification: "B.Tech", startYear: 2011, endYear: 2015, createdAt: "2026-11-21T10:00:00.000Z" }],
    experience: [{ id: "x1", title: "Engineer", company: "Acme", startDate: "2019-01", endDate: null, current: true, createdAt: "2026-11-21T10:00:00.000Z" }],
  };

  it("entries list with named remove buttons", async () => {
    const body = await check(<ProfileEntriesPanel entries={entries} busyId={null} error={null} onRemove={noop} />);
    expect([...body.querySelectorAll("button")].map((b) => b.getAttribute("aria-label"))).toEqual(["Remove B.Tech from my profile", "Remove Engineer at Acme from my profile"]);
    expect(body.textContent).toContain("Jan 2019 to present");
  });

  it("empty and error states", async () => {
    const empty = await check(<ProfileEntriesPanel entries={{ education: [], experience: [] }} busyId={null} error={null} onRemove={noop} />);
    expect(empty.textContent).toContain("will be listed here");
    mounted?.unmount();
    const err = await check(<ProfileEntriesPanel entries={entries} busyId={null} error="We could not remove it. Please try again." onRemove={noop} />);
    expect(err.querySelector('[role="alert"]')?.textContent).toContain("could not remove");
  });

  it("earlier versions: open and delete per version, rejected ones cannot be opened", async () => {
    const body = await check(<EarlierVersions versions={[resume({ id: "a", version: 1, isCurrent: false }), resume({ id: "b", version: 3, isCurrent: false, status: "rejected", failureCode: "unsafe_content" })]} busyId={null} onOpen={noop} onDelete={noop} />);
    const labels = [...body.querySelectorAll("button")].map((b) => b.getAttribute("aria-label"));
    expect(labels).toEqual(["Open version 1", "Delete version 1", "Delete version 3"]);
  });

  it("no earlier versions says so", async () => {
    const body = await check(<EarlierVersions versions={[]} busyId={null} onOpen={noop} onDelete={noop} />);
    expect(body.textContent).toContain("earlier versions are listed here");
  });

  it("the delete dialog names its effect, offers to keep it, and shows an error", async () => {
    mounted = await render(
      <main data-theme="grove">
        <h1>Your resume</h1>
        <h2>Section</h2>
        <DeleteResumeDialog open what="your resume" pending={false} error="We could not delete it. Please try again." onClose={noop} onConfirm={noop} />
      </main>,
    );
    await expectNoViolations(document.body);
    const dialog = document.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).toContain("Delete your resume?");
    expect(dialog.textContent).toContain("stay on your profile");
    expect(dialog.querySelector('[role="alert"]')?.textContent).toContain("could not delete");
    expect([...dialog.querySelectorAll("button")].map((b) => b.textContent?.trim())).toEqual(expect.arrayContaining(["Keep it", "Delete"]));
  });
});
