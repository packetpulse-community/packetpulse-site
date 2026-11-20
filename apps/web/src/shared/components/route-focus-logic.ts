// DOM-free helpers for the skip link and route-change focus (unit tested with fakes).

export interface QueryRoot {
  querySelector(selector: string): Element | null;
}

const HEADING_SELECTOR = "[data-page-heading], h1";

/** The element a person should land on after a route change: the page's H1. */
export function findPageHeading(root: QueryRoot): HTMLElement | null {
  return (root.querySelector(HEADING_SELECTOR) as HTMLElement | null) ?? null;
}

/**
 * Where "Skip to main content" goes. Prefers <main id="main">, then any <main>,
 * then the page heading (auth pages and a few public pages have no <main> yet).
 */
export function findSkipTarget(root: QueryRoot): HTMLElement | null {
  return (
    (root.querySelector("#main") as HTMLElement | null) ??
    (root.querySelector("main") as HTMLElement | null) ??
    findPageHeading(root)
  );
}

/** Should route-change focus be applied? Never steal focus from something the person is typing in. */
export function shouldMoveFocus(active: { tagName: string; isContentEditable?: boolean } | null): boolean {
  if (!active) return true;
  const tag = active.tagName.toUpperCase();
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return false;
  return !active.isContentEditable;
}
