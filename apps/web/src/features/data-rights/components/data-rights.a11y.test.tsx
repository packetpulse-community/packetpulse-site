// @vitest-environment jsdom
// Component-level axe scan of the data-rights screens (TASK-046 / TASK-050), every state.
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AdminDataRequestView, DataRequestView } from "@packetpulse/types";
import { expectNoViolations, render, type Rendered } from "@/test/axe";
import { AdminDataRequestsTable } from "./AdminDataRequests";
import { ConfirmErasureDialog } from "./ConfirmErasureDialog";
import { ErasurePanel } from "./ErasurePanel";
import { ExportPanel } from "./ExportPanel";
import { RetentionPanel } from "./RetentionPanel";

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

const req = (over: Partial<DataRequestView>): DataRequestView => ({
  id: "r1",
  kind: "export",
  status: "requested",
  requestedAt: "2026-11-01T10:00:00.000Z",
  scheduledFor: null,
  readyAt: null,
  expiresAt: null,
  completedAt: null,
  cancelledAt: null,
  ...over,
});
const noop = () => undefined;

async function check(ui: React.ReactElement) {
  mounted = await render(<main data-theme="grove"><h1>Your data</h1>{ui}</main>);
  await expectNoViolations(document.body);
  return document.body;
}

describe("export panel states", () => {
  const props = { enabled: true, availableDays: 7, busy: null, error: null, onRequest: noop, onDownload: noop, onDiscard: noop } as const;

  it.each([
    ["none", null],
    ["requested", req({ status: "requested" })],
    ["preparing", req({ status: "preparing" })],
    ["ready", req({ status: "ready", readyAt: "2026-11-01T10:05:00.000Z", expiresAt: "2026-11-08T10:05:00.000Z" })],
    ["expired", req({ status: "expired" })],
    ["discarded", req({ status: "cancelled" })],
    ["failed", req({ status: "failed" })],
  ] as const)("%s has no violations and names its state in words", async (_name, request) => {
    const body = await check(<ExportPanel {...props} request={request} />);
    expect(body.querySelector('[role="status"]')?.textContent?.length).toBeGreaterThan(10);
  });

  it("offers the right buttons per state", async () => {
    const ready = await check(<ExportPanel {...props} request={req({ status: "ready", expiresAt: "2026-11-08T10:05:00.000Z" })} />);
    const names = [...ready.querySelectorAll("button")].map((b) => b.textContent?.trim());
    expect(names).toEqual(expect.arrayContaining(["Download my data", "Discard this export"]));
    expect(names).not.toContain("Request my data");
  });

  it("shows an inline error as an alert", async () => {
    const body = await check(<ExportPanel {...props} request={null} error="We could not start your export. Please try again." />);
    expect(body.querySelector('[role="alert"]')?.textContent).toContain("could not start");
  });

  it("with the switch off shows the off state and no request button", async () => {
    const body = await check(<ExportPanel {...props} enabled={false} request={null} />);
    expect(body.textContent).toContain("Data export is switched off for now");
    expect([...body.querySelectorAll("button")].map((b) => b.textContent)).not.toContain("Request my data");
  });

  it("a ready export stays downloadable when the switch is off", async () => {
    const body = await check(<ExportPanel {...props} enabled={false} request={req({ status: "ready", expiresAt: "2026-11-08T10:05:00.000Z" })} />);
    expect([...body.querySelectorAll("button")].map((b) => b.textContent?.trim())).toContain("Download my data");
  });
});

describe("erasure panel states", () => {
  const props = { graceDays: 30, busy: false, error: null, onStart: noop, onCancel: noop } as const;

  it("not requested: offers deletion and lists what is deleted, anonymised and kept", async () => {
    const body = await check(<ErasurePanel {...props} request={null} />);
    expect([...body.querySelectorAll("button")].map((b) => b.textContent)).toContain("Delete my account…");
    for (const h of ["Deleted", "Kept without your name", "Kept for legal and safety reasons"]) expect(body.textContent).toContain(h);
  });

  it("scheduled: shows the date and offers to cancel, not to delete again", async () => {
    const body = await check(<ErasurePanel {...props} request={req({ kind: "erasure", status: "scheduled", scheduledFor: "2026-12-01T10:00:00.000Z" })} />);
    expect(body.textContent).toContain("Deletion scheduled for 1 Dec 2026");
    const names = [...body.querySelectorAll("button")].map((b) => b.textContent?.trim());
    expect(names).toContain("Cancel the deletion");
    expect(names).not.toContain("Delete my account…");
  });

  it("cancelled: says so and allows deleting again", async () => {
    const body = await check(<ErasurePanel {...props} request={req({ kind: "erasure", status: "cancelled", cancelledAt: "2026-11-05T10:00:00.000Z" })} />);
    expect(body.textContent).toContain("You cancelled the deletion");
    expect([...body.querySelectorAll("button")].map((b) => b.textContent)).toContain("Delete my account…");
  });

  it("shows an inline error as an alert", async () => {
    const body = await check(<ErasurePanel {...props} request={null} error="We could not cancel the deletion." />);
    expect(body.querySelector('[role="alert"]')?.textContent).toContain("could not cancel");
  });
});

describe("confirm deletion dialog", () => {
  it("has a labelled password field and shows a wrong-password error tied to it", async () => {
    mounted = await render(<main data-theme="grove"><h1>Your data</h1><ConfirmErasureDialog open onClose={noop} graceDays={30} pending={false} error="Password is incorrect" onConfirm={noop} /></main>);
    await expectNoViolations(document.body);
    const input = document.querySelector<HTMLInputElement>('input[type="password"]')!;
    expect(input).toBeTruthy();
    expect(document.querySelector(`label[for="${input.id}"]`)?.textContent).toContain("password");
    const errorId = input.getAttribute("aria-describedby")!;
    expect(document.getElementById(errorId)?.textContent).toBe("Password is incorrect");
    expect(input.getAttribute("aria-invalid")).toBe("true");
  });

  it("keeps the confirm button off until a password is typed", async () => {
    mounted = await render(<main data-theme="grove"><h1>Your data</h1><ConfirmErasureDialog open onClose={noop} graceDays={30} pending={false} error={null} onConfirm={noop} /></main>);
    const confirm = [...document.querySelectorAll("button")].find((b) => b.textContent?.includes("Schedule deletion"));
    expect(confirm?.hasAttribute("disabled")).toBe(true);
  });
});

describe("retention and admin list", () => {
  it("retention table has no violations and a caption", async () => {
    const body = await check(<RetentionPanel />);
    expect(body.querySelector("caption")?.textContent).toContain("Retention");
  });

  it("admin table is read-only: no buttons or links to open a request", async () => {
    const row: AdminDataRequestView = {
      ...req({ kind: "erasure", status: "scheduled", scheduledFor: "2026-12-01T10:00:00.000Z" }),
      user: { id: "u1", firstName: "Asha", lastName: "Rao", email: "asha@example.com", erased: false },
      audit: [{ action: "account_deletion_requested", at: "2026-11-01T10:00:00.000Z" }],
    };
    const body = await check(<AdminDataRequestsTable rows={[row, { ...row, id: "r2", user: { ...row.user, erased: true } }]} />);
    expect(body.querySelectorAll("button, a")).toHaveLength(0);
    expect(body.textContent).toContain("Deletion requested");
    expect(body.textContent).toContain("Deleted member");
  });
});
