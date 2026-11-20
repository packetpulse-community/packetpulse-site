import { describe, expect, it } from "vitest";
import { findPageHeading, findSkipTarget, shouldMoveFocus, type QueryRoot } from "./route-focus-logic";

function root(map: Record<string, string>): QueryRoot {
  return { querySelector: (sel) => (map[sel] ? ({ id: map[sel] } as unknown as Element) : null) };
}

describe("findSkipTarget", () => {
  it("prefers #main", () => {
    const el = findSkipTarget(root({ "#main": "a", main: "b", "[data-page-heading], h1": "c" }));
    expect((el as unknown as { id: string }).id).toBe("a");
  });
  it("falls back to any main, then the heading", () => {
    expect((findSkipTarget(root({ main: "b", "[data-page-heading], h1": "c" })) as unknown as { id: string }).id).toBe("b");
    expect((findSkipTarget(root({ "[data-page-heading], h1": "c" })) as unknown as { id: string }).id).toBe("c");
  });
  it("returns null when the page has nothing to skip to", () => {
    expect(findSkipTarget(root({}))).toBeNull();
  });
});

describe("findPageHeading", () => {
  it("finds the heading or returns null", () => {
    expect(findPageHeading(root({ "[data-page-heading], h1": "h" }))).not.toBeNull();
    expect(findPageHeading(root({}))).toBeNull();
  });
});

describe("shouldMoveFocus", () => {
  it("moves focus from body or links, not from form fields", () => {
    expect(shouldMoveFocus(null)).toBe(true);
    expect(shouldMoveFocus({ tagName: "BODY" })).toBe(true);
    expect(shouldMoveFocus({ tagName: "A" })).toBe(true);
    expect(shouldMoveFocus({ tagName: "INPUT" })).toBe(false);
    expect(shouldMoveFocus({ tagName: "textarea" })).toBe(false);
    expect(shouldMoveFocus({ tagName: "DIV", isContentEditable: true })).toBe(false);
  });
});
