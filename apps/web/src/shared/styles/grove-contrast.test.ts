import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { contrastRatio } from "./contrast";
import { CONTRAST_PAIRS, MIN_RATIO } from "./grove-contrast-pairs";

// Parses grove-tokens.css and checks the Document 2 section 4.4 claims in both themes.

const css = readFileSync(join(__dirname, "grove-tokens.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

function blockVars(selectorStart: string): Record<string, string> {
  const start = css.indexOf(selectorStart);
  if (start < 0) throw new Error(`Missing block ${selectorStart}`);
  const body = css.slice(css.indexOf("{", start) + 1, css.indexOf("}", start));
  const vars: Record<string, string> = {};
  for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) vars[m[1] as string] = (m[2] as string).trim();
  return vars;
}

const light = blockVars('[data-theme="grove"] {');
const dark = { ...light, ...blockVars('[data-theme="grove"].dark,') };

const themes = { light, dark };

describe("Signal Grove tokens", () => {
  it("dark block overrides every colour that the light block defines", () => {
    const colourVars = Object.keys(light).filter((k) => /^#[0-9a-f]{6}$/i.test(light[k] ?? ""));
    const darkOnly = blockVars('[data-theme="grove"].dark,');
    for (const k of colourVars) expect(darkOnly, `dark value missing for ${k}`).toHaveProperty(k);
  });

  for (const [theme, vars] of Object.entries(themes)) {
    describe(`${theme} theme`, () => {
      for (const pair of CONTRAST_PAIRS) {
        it(`${pair.name} (${pair.kind}) >= ${MIN_RATIO[pair.kind]}:1`, () => {
          const fg = vars[pair.fg] as string;
          const bg = vars[pair.bg] as string;
          expect(fg, `${pair.fg} is not defined`).toBeDefined();
          expect(bg, `${pair.bg} is not defined`).toBeDefined();
          const ratio = contrastRatio(fg, bg);
          expect(
            ratio,
            `${theme}: "${pair.name}" ${pair.fg} ${fg} on ${pair.bg} ${bg} is ${ratio.toFixed(2)}:1, needs ${MIN_RATIO[pair.kind]}:1`,
          ).toBeGreaterThanOrEqual(MIN_RATIO[pair.kind]);
        });
      }
    });
  }
});
