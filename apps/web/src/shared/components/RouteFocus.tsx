"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { findPageHeading, shouldMoveFocus } from "./route-focus-logic";

// After a client-side navigation, move focus to the new page's heading so screen
// reader and keyboard users know the page changed (Document 2 section 10). Used by
// the two app shells. The heading may arrive after the loading skeleton, so it is
// watched for up to 1.5 s; if there is none, focus goes to <main>.
export function RouteFocus() {
  const pathname = usePathname();
  const lastPath = useRef(pathname);

  useEffect(() => {
    // Only react to a real path change. A boolean "first run" flag is flipped by the
    // first of React Strict Mode's two dev-time effect runs, so the second run moved focus
    // and wrote tabindex/style onto the heading before hydration (a hydration warning).
    if (lastPath.current === pathname) return; // first load: the browser already starts at the top
    lastPath.current = pathname;
    if (!shouldMoveFocus(document.activeElement as HTMLElement | null)) return;
    const main = document.getElementById("main") ?? document.querySelector("main");
    if (!main) return;

    function focusEl(el: HTMLElement) {
      if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
      el.style.outline = "none"; // programmatic focus target only, not an operable control
      el.focus({ preventScroll: false });
    }

    const heading = findPageHeading(main);
    if (heading) {
      focusEl(heading);
      return;
    }
    const observer = new MutationObserver(() => {
      const h = findPageHeading(main);
      if (h) {
        observer.disconnect();
        window.clearTimeout(timer);
        focusEl(h);
      }
    });
    observer.observe(main, { childList: true, subtree: true });
    const timer = window.setTimeout(() => {
      observer.disconnect();
      focusEl(main as HTMLElement);
    }, 1500);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, [pathname]);

  return null;
}
