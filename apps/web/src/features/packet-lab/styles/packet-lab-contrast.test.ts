import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { contrastRatio } from "@/shared/styles/contrast";
import { PL_PAIRS, PROTOCOLS } from "./packet-lab-pairs";

const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "");
const grove = strip(readFileSync(join(__dirname, "../../../shared/styles/grove-tokens.css"), "utf8"));
const lab = strip(readFileSync(join(__dirname, "packet-lab.css"), "utf8"));

function block(css: string, start: string): Record<string, string> {
  const at = css.indexOf(start);
  if (at < 0) throw new Error(`Missing block ${start}`);
  const body = css.slice(css.indexOf("{", at) + 1, css.indexOf("}", at));
  const vars: Record<string, string> = {};
  for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) vars[m[1] as string] = (m[2] as string).trim();
  return vars;
}

const light = { ...block(grove, '[data-theme="grove"] {'), ...block(lab, '[data-theme="grove"] {') };
const dark = { ...light, ...block(grove, '[data-theme="grove"].dark,'), ...block(lab, '[data-theme="grove"].dark,') };

describe("Packet Lab protocol colours", () => {
  it("define a dark value for every protocol", () => {
    const d = block(lab, '[data-theme="grove"].dark,');
    for (const p of PROTOCOLS) {
      expect(d).toHaveProperty(`--pl-${p}`);
      expect(d).toHaveProperty(`--pl-${p}-soft`);
    }
  });
  for (const [mode, vars] of Object.entries({ light, dark })) {
    describe(mode, () => {
      for (const pair of PL_PAIRS) {
        it(`${pair.name} >= 4.5:1`, () => {
          const fg = vars[pair.fg] as string;
          const bg = vars[pair.bg] as string;
          expect(fg, pair.fg).toBeDefined();
          expect(bg, pair.bg).toBeDefined();
          expect(contrastRatio(fg, bg), `${mode} ${pair.fg} ${fg} on ${pair.bg} ${bg}`).toBeGreaterThanOrEqual(4.5);
        });
      }
    });
  }
});
