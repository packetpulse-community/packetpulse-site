// Shared helper for the component-level accessibility checks (TASK-050).
// Renders a React tree into jsdom, runs axe-core on it and returns the violations.
//
// jsdom has no layout or stylesheet engine, so the `color-contrast` rule cannot run here; contrast is
// guarded by grove-contrast.test.ts (token pairs) and by the route scan (scripts/a11y-scan.mjs, real browser).
import axe from "axe-core";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

// jsdom does not implement canvas; axe probes it for icon-ligature detection. Returning null silences the warning.
if (typeof HTMLCanvasElement !== "undefined") HTMLCanvasElement.prototype.getContext = (() => null) as never;

// Browser APIs jsdom lacks that the app's components touch on mount.
if (typeof window !== "undefined") {
  window.matchMedia ??= ((query: string) => ({
    matches: false, media: query, onchange: null,
    addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false,
  })) as never;
  class NoopObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() { return []; }
  }
  (globalThis as Record<string, unknown>).ResizeObserver ??= NoopObserver;
  (globalThis as Record<string, unknown>).IntersectionObserver ??= NoopObserver;
  Element.prototype.scrollIntoView ??= () => {};
}

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

export interface Rendered {
  container: HTMLElement;
  root: Root;
  unmount: () => void;
}

export async function render(ui: React.ReactElement): Promise<Rendered> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(ui);
  });
  return {
    container,
    root,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

// WCAG 2.x A/AA + best-practice rules. `region` is skipped because fragments are rendered without a page shell.
const RUN_ONLY = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];

export async function scan(node: Element = document.body, extraDisabled: string[] = []) {
  const rules: Record<string, { enabled: boolean }> = { "color-contrast": { enabled: false }, region: { enabled: false } };
  for (const id of extraDisabled) rules[id] = { enabled: false };
  const results = await axe.run(node as axe.ElementContext, { runOnly: { type: "tag", values: RUN_ONLY }, rules });
  return results.violations;
}

export function formatViolations(violations: axe.Result[]): string {
  return violations
    .map((v) => `${v.id} (${v.impact}): ${v.help}\n${v.nodes.map((n) => `  ${n.html}`).join("\n")}`)
    .join("\n");
}

export async function expectNoViolations(node?: Element, extraDisabled?: string[]) {
  const v = await scan(node, extraDisabled);
  if (v.length) throw new Error(`axe found ${v.length} violation(s):\n${formatViolations(v)}`);
}
