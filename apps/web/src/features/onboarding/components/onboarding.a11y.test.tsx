// @vitest-environment jsdom
// Axe scan of the sign-up verification and onboarding screens (TASK-022, TASK-023, TEST-A11Y). Contrast
// is covered by the route scan in a real browser; this checks names, labels, errors and structure.
import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import type { OnboardingStatus } from "@packetpulse/types";
import { expectNoViolations, render, type Rendered } from "@/test/axe";
import { OnboardingFlow } from "./OnboardingFlow";
import { VerifyEmailCodeForm } from "@/features/auth/components/VerifyEmailCodeForm";

vi.mock("next/navigation", () => ({
  usePathname: () => "/onboarding",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, prefetch: _p, ...rest }: { href: string; children: React.ReactNode; prefetch?: boolean }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const status = (over: Partial<OnboardingStatus> = {}): OnboardingStatus => ({
  complete: false,
  completedAt: null,
  missing: ["professionalExperience", "dateOfBirth", "targetRole", "careerGoals", "skills"],
  nextStep: "about",
  values: { professionalExperience: null, dateOfBirth: null, targetRole: null, careerGoals: null, whatsappNumber: null, skillCount: 0 },
  ...over,
});

let mounted: Rendered | undefined;
afterEach(() => {
  mounted?.unmount();
  mounted = undefined;
});

const withQuery = (ui: React.ReactElement) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>
);

describe("sign-up verification and onboarding have no axe violations", () => {
  it("the email code screen, empty and with errors", async () => {
    mounted = await render(withQuery(<VerifyEmailCodeForm codeJustSent />));
    await expectNoViolations();
    const form = mounted.container.querySelector("form")!;
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(mounted.container.querySelector("#verify-email-error, #verify-code-error")).not.toBeNull();
    await expectNoViolations();
  });

  it.each(["about", "goals", "contact"] as const)("the %s step", async (step) => {
    mounted = await render(
      withQuery(<OnboardingFlow initial={status({ nextStep: step, missing: step === "contact" ? [] : status().missing })} taxonomy={[]} initialSkills={[]} />),
    );
    expect(mounted.container.querySelector("h1")?.textContent).toBeTruthy();
    await expectNoViolations();
  });

  it("the about step with inline field errors", async () => {
    mounted = await render(withQuery(<OnboardingFlow initial={status()} taxonomy={[]} initialSkills={[]} />));
    const form = mounted.container.querySelector("form")!;
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    const alerts = [...mounted.container.querySelectorAll("[id$='-error']")].map((n) => n.textContent);
    expect(alerts.length).toBeGreaterThan(0);
    expect(mounted.container.querySelector("#dateOfBirth")?.getAttribute("aria-invalid")).toBe("true");
    await expectNoViolations();
  });

  it("the skills step with nothing saved keeps Continue disabled", async () => {
    mounted = await render(withQuery(<OnboardingFlow initial={status({ nextStep: "skills" })} taxonomy={[]} initialSkills={[]} />));
    const buttons = [...mounted.container.querySelectorAll("button")];
    expect(buttons.find((b) => b.textContent === "Continue")?.disabled).toBe(true);
    await expectNoViolations();
  });
});
