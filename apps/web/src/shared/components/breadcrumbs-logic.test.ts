import { describe, expect, it } from "vitest";
import { buildCrumbs, crumbLabel } from "./breadcrumbs-logic";

const UUID = "3f2b8c1e-9d4a-4e6b-8a1f-0c7d5e2b9a41";

describe("buildCrumbs", () => {
  it("shows nothing on top-level pages (not deeper than two levels)", () => {
    expect(buildCrumbs("/dashboard")).toEqual([]);
    expect(buildCrumbs("/forums")).toEqual([]);
    expect(buildCrumbs("/")).toEqual([]);
  });

  it("names a thread, never its id", () => {
    expect(buildCrumbs(`/forums/${UUID}`)).toEqual([
      { label: "Home", href: "/dashboard" },
      { label: "Forums", href: "/forums" },
      { label: "Thread", href: null },
    ]);
  });

  it.each([
    [`/resources/${UUID}`, "Resource"],
    [`/recordings/${UUID}`, "Recording"],
    [`/quizzes/${UUID}`, "Quiz"],
    ["/quizzes/new", "New quiz"],
  ])("labels %s as %s", (path, label) => {
    const crumbs = buildCrumbs(path);
    expect(crumbs.at(-1)?.label).toBe(label);
    expect(crumbs.map((c) => c.label).join(" ")).not.toContain(UUID);
  });

  it("keeps every parent crumb linked and the last one plain", () => {
    const crumbs = buildCrumbs(`/quizzes/${UUID}/edit`);
    expect(crumbs.map((c) => c.label)).toEqual(["Home", "Quizzes", "Quiz", "Edit"]);
    expect(crumbs.map((c) => c.href)).toEqual(["/dashboard", "/quizzes", `/quizzes/${UUID}`, null]);
  });

  it("lets the page override the last crumb with its real title", () => {
    const crumbs = buildCrumbs(`/forums/${UUID}`, "  How do I subnet a /27?  ");
    expect(crumbs.at(-1)).toEqual({ label: "How do I subnet a /27?", href: null });
    expect(buildCrumbs(`/forums/${UUID}`, "   ").at(-1)?.label).toBe("Thread");
    expect(buildCrumbs(`/forums/${UUID}`, null).at(-1)?.label).toBe("Thread");
  });

  it("does not link a crumb whose path has no page", () => {
    expect(buildCrumbs("/settings/notifications")).toEqual([
      { label: "Home", href: "/dashboard" },
      { label: "Settings", href: null },
      { label: "Notification settings", href: null },
    ]);
  });

  it("covers the Packet Lab scenario pages", () => {
    expect(buildCrumbs("/tools/packet-lab/tcp-handshake").map((c) => c.label)).toEqual(["Home", "Tools", "Packet Lab", "Scenario"]);
  });

  it("uses registry names in admin", () => {
    expect(buildCrumbs("/admin/api-docs").map((c) => c.label)).toEqual(["Home", "Admin", "API docs"]);
  });
});

describe("crumbLabel fallback", () => {
  it("never prints an unknown id", () => {
    expect(crumbLabel(["somewhere", UUID])).toBe("Details");
    expect(crumbLabel(["somewhere", "12345"])).toBe("Details");
    expect(crumbLabel(["somewhere", "clx8f3k2a0001abcd1234efgh"])).toBe("Details");
  });
  it("title-cases an unknown readable segment", () => {
    expect(crumbLabel(["somewhere", "new-feature"])).toBe("New Feature");
  });
});
