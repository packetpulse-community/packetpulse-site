// @vitest-environment jsdom
// TASK-026: axe scan and behaviour checks of the community components (TEST-050, TEST-A11Y).
import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { ApiError } from "@/shared/api/http-client";
import { expectNoViolations, render, type Rendered } from "@/test/axe";
import { ReasonDialog } from "./ReasonDialog";
import { ReportDialog } from "./ReportDialog";
import { ReputationLine } from "./ReputationLine";
import { ThreadCard } from "./ThreadCard";
import type { ForumThreadSummary } from "../api/forums.api";

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

const thread: ForumThreadSummary = {
  id: "t1",
  categoryId: "c1",
  title: "How does OSPF elect a DR?",
  content: "I want to understand the election order.",
  slug: "how",
  isPinned: false,
  isLocked: false,
  viewCount: 3,
  replyCount: 2,
  lastReplyAt: "2026-11-21T00:00:00Z",
  mode: "production",
  acceptedReplyId: "r1",
  author: { id: "u1", firstName: "Asha", lastName: "Rao", avatarUrl: null },
  category: { id: "c1", name: "Routing", slug: "routing", description: null, position: 1 },
  _count: { replies: 2 },
};

const tick = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
const typeInto = async (el: HTMLTextAreaElement | HTMLInputElement, value: string) => {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
};

describe("community components", () => {
  it("ThreadCard shows the mode and the answered state as text", async () => {
    mounted = await render(<main><h1>Forums</h1><ThreadCard thread={thread} /></main>);
    expect(document.body.textContent).toContain("Production issue");
    expect(document.body.textContent).toContain("✓ Answered");
    await expectNoViolations(document.body);
  });

  it("ReputationLine is text plus a number, never colour alone", async () => {
    mounted = await render(<p><ReputationLine reputation={{ userId: "u", points: 42, level: "Contributor", acceptedAnswers: 2 }} /></p>);
    expect(document.body.textContent).toContain("Reputation 42 · Contributor · 2 accepted answers");
  });

  it("ReasonDialog is accessible, refuses a short reason inline, and shows a server error without losing the text", async () => {
    const onConfirm = vi.fn().mockRejectedValue(new ApiError(400, { message: "A reason is required for this moderator action." }));
    mounted = await render(<ReasonDialog open onClose={() => {}} title="Remove this reply" description="The author is told." confirmLabel="Remove" onConfirm={onConfirm} destructive />);
    await tick();
    await expectNoViolations(document.body);
    const form = document.querySelector("form")!;
    const ta = document.querySelector("textarea")!;
    await typeInto(ta, "no");
    await act(async () => { form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    expect(document.querySelector('[role="alert"]')?.textContent).toMatch(/at least 5 characters/);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(ta.getAttribute("aria-invalid")).toBe("true");
    await typeInto(ta, "Advertising is not allowed");
    await act(async () => { form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    await tick();
    expect(onConfirm).toHaveBeenCalledWith("Advertising is not allowed");
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("A reason is required");
    expect(document.querySelector("textarea")!.value).toBe("Advertising is not allowed");
  });

  it("ReportDialog is accessible and needs a reason before it sends", async () => {
    const onSubmit = vi.fn().mockResolvedValue({ id: "x" });
    mounted = await render(<ReportDialog open onClose={() => {}} what="reply" onSubmit={onSubmit} />);
    await tick();
    await expectNoViolations(document.body);
    const form = document.querySelector("form")!;
    await act(async () => { form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("Choose what is wrong");
    expect(onSubmit).not.toHaveBeenCalled();
    const radio = document.querySelector<HTMLInputElement>('input[type="radio"][value="spam"]')!;
    await act(async () => { radio.click(); });
    await act(async () => { form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    await tick();
    expect(onSubmit).toHaveBeenCalledWith({ reason: "spam", details: undefined });
    expect(document.querySelector('[role="status"]')?.textContent).toContain("Thank you");
  });
});
