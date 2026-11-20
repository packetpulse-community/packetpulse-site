"use client";

import { useEffect, useState, type RefObject } from "react";
import { contrastRatio } from "@/shared/styles/contrast";
import { CONTRAST_PAIRS, MIN_RATIO } from "@/shared/styles/grove-contrast-pairs";
import { COLOUR_GROUPS, RADII, SPACING } from "./tokens";

/** Reads the resolved values of the Grove variables from the themed wrapper. */
function useResolvedVars(ref: RefObject<HTMLElement | null>, themeKey: string): Record<string, string> {
  const [vars, setVars] = useState<Record<string, string>>({});
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const cs = getComputedStyle(el);
    const names = [
      ...COLOUR_GROUPS.flatMap((g) => g.tokens.map((x) => x.cssVar)),
      ...CONTRAST_PAIRS.flatMap((p) => [p.fg, p.bg]),
    ];
    const next: Record<string, string> = {};
    for (const n of names) next[n] = cs.getPropertyValue(n).trim();
    setVars(next);
  }, [ref, themeKey]);
  return vars;
}

const isHex = (v: string | undefined): v is string => !!v && /^#[0-9a-f]{6}$/i.test(v);

export function TokenSections({ wrapperRef, themeKey }: { wrapperRef: RefObject<HTMLElement | null>; themeKey: string }) {
  const vars = useResolvedVars(wrapperRef, themeKey);
  return (
    <>
      <section aria-labelledby="swatches" className="space-y-6">
        <h2 id="swatches" className="text-2xl font-semibold">
          Colour tokens
        </h2>
        {COLOUR_GROUPS.map((group) => (
          <div key={group.title}>
            <h3 className="mb-3 text-[17px] font-semibold">{group.title}</h3>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.tokens.map((tok) => (
                <li
                  key={tok.cssVar}
                  className="flex items-center gap-3 rounded-grove-card border border-grove-border bg-grove-surface p-3"
                >
                  <span
                    aria-hidden="true"
                    className="h-10 w-10 shrink-0 rounded-grove-control border border-grove-control"
                    style={{ background: `var(${tok.cssVar})` }}
                  />
                  <span className="min-w-0 text-sm">
                    <span className="block font-semibold">{tok.name}</span>
                    <code className="block font-grove-mono text-xs text-grove-text-secondary">
                      {tok.cssVar} {vars[tok.cssVar] ?? ""}
                    </code>
                    <code className="block font-grove-mono text-xs text-grove-text-secondary">{tok.tailwind}</code>
                    <span className="block text-xs text-grove-text-secondary">{tok.use}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section aria-labelledby="contrast" className="space-y-3">
        <h2 id="contrast" className="text-2xl font-semibold">
          Contrast results
        </h2>
        <p className="text-sm text-grove-text-secondary">
          Measured live from the values in the current theme. Text pairs need 4.5:1; control borders and the focus
          ring need 3:1 (Document 2 section 4.4). The same pairs are asserted by the automated test.
        </p>
        <div className="overflow-x-auto rounded-grove-card border border-grove-border">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Contrast of token pairs in the selected theme</caption>
            <thead className="bg-grove-subtle">
              <tr>
                <th scope="col" className="p-3">Pair</th>
                <th scope="col" className="p-3">Sample</th>
                <th scope="col" className="p-3">Ratio</th>
                <th scope="col" className="p-3">Needs</th>
                <th scope="col" className="p-3">Result</th>
              </tr>
            </thead>
            <tbody>
              {CONTRAST_PAIRS.map((p) => {
                const fg = vars[p.fg];
                const bg = vars[p.bg];
                const ok = isHex(fg) && isHex(bg);
                const ratio = ok ? contrastRatio(fg, bg) : null;
                const need = MIN_RATIO[p.kind];
                return (
                  <tr key={p.name} className="border-t border-grove-border">
                    <th scope="row" className="p-3 font-medium">{p.name}</th>
                    <td className="p-3">
                      <span
                        className="inline-block rounded-grove-tag border border-grove-border px-2 py-0.5 font-semibold"
                        style={{ color: `var(${p.fg})`, background: `var(${p.bg})` }}
                      >
                        Aa 123
                      </span>
                    </td>
                    <td className="p-3 font-grove-mono tabular-nums">{ratio ? `${ratio.toFixed(2)}:1` : "…"}</td>
                    <td className="p-3 font-grove-mono tabular-nums">{need}:1</td>
                    <td className="p-3 font-semibold">
                      {ratio === null ? "…" : ratio >= need ? "✓ Pass" : "✗ Fail"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="shape" className="space-y-6">
        <h2 id="shape" className="text-2xl font-semibold">
          Shape, spacing, elevation and type
        </h2>
        <div>
          <h3 className="mb-3 text-[17px] font-semibold">Radius</h3>
          <ul className="flex flex-wrap gap-4">
            {RADII.map((r) => (
              <li key={r.name} className="text-sm">
                <div className={`mb-2 h-16 w-24 border-2 border-grove-control bg-grove-subtle ${r.cls}`} />
                <span className="block font-semibold">{r.name}</span>
                <code className="block font-grove-mono text-xs text-grove-text-secondary">{r.cls}</code>
                <span className="text-xs text-grove-text-secondary">{r.use}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-[17px] font-semibold">Spacing rhythm (4 px)</h3>
          <ul className="space-y-1">
            {SPACING.map((n) => (
              <li key={n} className="flex items-center gap-3 text-sm">
                <code className="w-24 font-grove-mono text-xs">space-{n} · {n * 4}px</code>
                <span className="block h-3 rounded-grove-tag bg-grove-brand" style={{ width: `var(--grove-space-${n})` }} />
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-[17px] font-semibold">Elevation</h3>
          <div className="flex flex-wrap gap-6">
            <div className="rounded-grove-card border border-grove-border bg-grove-surface p-4 text-sm">
              Surface: border only, no shadow
            </div>
            <div className="rounded-grove-card border border-grove-border bg-grove-surface p-4 text-sm shadow-grove-overlay">
              Overlay: <code className="font-grove-mono">shadow-grove-overlay</code>
            </div>
            <div className="rounded-grove-card bg-grove-scrim p-4 text-sm text-grove-on-brand">
              Scrim: <code className="font-grove-mono">bg-grove-scrim</code>
            </div>
          </div>
        </div>
        <div>
          <h3 className="mb-3 text-[17px] font-semibold">Typography stacks (no font is downloaded)</h3>
          <p className="font-grove-sans text-base">
            UI and body: Inter, then Noto Sans Devanagari, then system fonts. नमस्ते, पैकेटपल्स।
          </p>
          <p className="mt-2 font-grove-mono text-[30px] font-semibold leading-9 tabular-nums">12,480 · TX-0042</p>
          <p className="text-sm text-grove-text-secondary">Metric value: JetBrains Mono, 30/36, 600 (falls back to the system monospace).</p>
        </div>
      </section>
    </>
  );
}
