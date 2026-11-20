"use client";

import { findSkipTarget } from "./route-focus-logic";

// First focusable element in the body (WCAG 2.4.1). Hidden until it receives
// keyboard focus. Moves focus to <main id="main"> (or the page heading when a
// page has no main landmark) so the next Tab starts inside the content.
export function SkipLink() {
  return (
    <a
      href="#main"
      onClick={(e) => {
        const target = findSkipTarget(document);
        if (!target) return;
        e.preventDefault();
        if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
        target.focus();
        target.scrollIntoView({ block: "start" });
      }}
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-indigo-600 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
    >
      Skip to main content
    </a>
  );
}
