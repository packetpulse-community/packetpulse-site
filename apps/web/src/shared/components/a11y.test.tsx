// @vitest-environment jsdom
// Component-level axe-core scan of the shell: skip link, nav, footer, breadcrumbs, status screens and the
// command palette (TASK-050, TEST-A11Y). Part of the normal web unit test run.
import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { expectNoViolations, render, type Rendered } from "@/test/axe";
import { SkipLink } from "./SkipLink";
import { StatusScreen } from "./StatusScreen";
import { CalloutBox } from "./CalloutBox";
import { Breadcrumbs, BreadcrumbsProvider } from "./Breadcrumbs";
import { CommandPalette } from "./CommandPalette";
import { SidebarNav } from "@/shared/layouts/SidebarNav";
import { AuthProvider } from "@/shared/auth/AuthProvider";
import { navigationFor } from "@/shared/config/navigation";
import { Navbar } from "@/features/landing/components/Navbar";
import { Footer } from "@/features/landing/components/Footer";
import { ThemeSwitch } from "@/shared/theme/ThemeSwitch";

let pathname = "/resources/networking";
const push = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push, replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, prefetch: _p, ...rest }: { href: string; children: React.ReactNode; prefetch?: boolean }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt: string; src: string }) => <img alt={alt} src={src} />,
}));

const user = {
  id: "u1",
  firstName: "Asha",
  lastName: "Rao",
  email: "asha@example.test",
  avatarUrl: null,
  bio: null,
  isApproved: true,
  emailVerified: true,
  roles: ["member"],
  permissions: [],
};

let mounted: Rendered | undefined;
afterEach(() => {
  mounted?.unmount();
  mounted = undefined;
  document.body.innerHTML = "";
  push.mockClear();
});

describe("shell components have no axe violations", () => {
  it("skip link + main landmark", async () => {
    mounted = await render(
      <>
        <SkipLink />
        <main id="main">
          <h1>Page</h1>
        </main>
      </>,
    );
    await expectNoViolations();
  });

  it("StatusScreen (page and embedded) and CalloutBox", async () => {
    mounted = await render(
      <>
        <StatusScreen icon={<span />} title="Page not found" action={{ label: "Go home", href: "/" }} reference="PP-404">
          That page does not exist.
        </StatusScreen>
      </>,
    );
    await expectNoViolations();
    mounted.unmount();
    mounted = await render(
      <main>
        <h1>Help</h1>
        <h2>Need more?</h2>
        <CalloutBox title="Talk to us" description="We reply within a day." />
      </main>,
    );
    await expectNoViolations();
  });

  it("landing Navbar (closed and mobile menu open) and Footer", async () => {
    mounted = await render(
      <>
        <Navbar />
        <main>
          <h1>Home</h1>
        </main>
        <Footer />
      </>,
    );
    await expectNoViolations();
    const toggle = document.querySelector<HTMLButtonElement>("button[aria-expanded]");
    if (toggle) {
      await act(async () => toggle.click());
      await expectNoViolations();
    }
  });

  it("member sidebar navigation", async () => {
    const sections = navigationFor(user as never).sidebar;
    mounted = await render(
      <nav aria-label="Main">
        <SidebarNav sections={sections} />
      </nav>,
    );
    await expectNoViolations();
  });

  it("breadcrumbs and the theme switch", async () => {
    mounted = await render(
      <BreadcrumbsProvider>
        <Breadcrumbs />
        <main>
          <h1>Networking</h1>
          <ThemeSwitch />
        </main>
      </BreadcrumbsProvider>,
    );
    await expectNoViolations();
  });
});

describe("command palette", () => {
  async function open() {
    mounted = await render(
      <AuthProvider user={user as never}>
        <button type="button">Trigger</button>
        <main>
          <h1>Dashboard</h1>
        </main>
        <CommandPalette />
      </AuthProvider>,
    );
    document.querySelector<HTMLButtonElement>("button")!.focus();
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }));
    });
  }

  it("opens as a labelled modal dialog with no axe violations", async () => {
    await open();
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog!.getAttribute("aria-modal")).toBe("true");
    expect(dialog!.getAttribute("aria-label")).toBeTruthy();
    await expectNoViolations();
  });

  it("moves focus to the search box and gives it back to the trigger on Escape", async () => {
    await open();
    const input = document.querySelector("input")!;
    expect(document.activeElement).toBe(input);
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(document.querySelector("button"));
  });

  it("Tab does not leave the palette (no keyboard trap, no escape to the page behind)", async () => {
    await open();
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
    const input = document.querySelector<HTMLInputElement>("input")!;
    await act(async () => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));
    });
    expect(dialog.contains(document.activeElement)).toBe(true);
  });
});
