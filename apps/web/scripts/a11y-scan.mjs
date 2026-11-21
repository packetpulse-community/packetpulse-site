#!/usr/bin/env node
// Route-level accessibility scan (TASK-050): drives a real Chromium through every screen in Light and Dark,
// at desktop and 375px width, and runs axe-core (WCAG 2.2 A/AA + best practice) on each page.
//
// Usage (against a running production build, e.g. `next start -p 3100`):
//   node apps/web/scripts/a11y-scan.mjs --base http://localhost:3100 --set public
//   A11Y_EMAIL=... A11Y_PASSWORD=... node apps/web/scripts/a11y-scan.mjs --set signed-in --out /tmp/signed-in.json
//
// Options:
//   --base <url>       app origin (default http://localhost:3100)
//   --set <name>       public | signed-in | all (default public). signed-in needs A11Y_EMAIL / A11Y_PASSWORD
//                      of a LOCAL test account; admin pages need an admin account. Never use real accounts.
//   --themes <list>    comma list of light,dark (default light,dark)
//   --widths <list>    comma list of viewport widths (default 1280,375)
//   --extra <paths>    comma list of extra paths to scan (detail pages that need real data)
//   --out <file>       write the full JSON result here
//   --chromium <path>  Chromium/Chrome executable (default: PLAYWRIGHT_CHROMIUM env, else ~/.cache/ms-playwright)
//
// Credentials only ever come from the environment; nothing is stored. Point it at a LOCAL backend only.
import { createRequire } from "node:module";
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright-core");
const axeSource = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .reduce((acc, a, i, all) => (a.startsWith("--") ? [...acc, [a.slice(2), all[i + 1]?.startsWith("--") ? "true" : (all[i + 1] ?? "true")]] : acc), []),
);
const base = (args.base ?? "http://localhost:3100").replace(/\/$/, "");
const set = args.set ?? "public";
const themes = (args.themes ?? "light,dark").split(",");
const widths = (args.widths ?? "1280,375").split(",").map(Number);
const extra = args.extra ? args.extra.split(",") : [];

const PUBLIC = [
  "/", "/about", "/contact", "/privacy", "/terms", "/blogs", "/tools", "/tools/packet-lab", "/login", "/register",
  "/forgot-password", "/verify-email", "/maintenance", "/design-system", "/this-page-does-not-exist",
];
const MEMBER = [
  "/dashboard", "/resources", "/recordings", "/forums", "/quizzes", "/quizzes/new", "/certificates", "/notifications",
  "/profile", "/settings/notifications", "/network-tools",
];
const ADMIN = [
  "/admin", "/admin/analytics", "/admin/api-docs", "/admin/blogs", "/admin/categories", "/admin/forums", "/admin/logs",
  "/admin/quizzes", "/admin/quizzes/new", "/admin/recordings", "/admin/resources", "/admin/settings", "/admin/status",
  "/admin/taxonomy", "/admin/users",
];

const routes = [
  ...(set === "public" || set === "all" ? PUBLIC : []),
  ...(set === "signed-in" || set === "all" ? [...MEMBER, ...ADMIN] : []),
  ...extra,
];

function findChromium() {
  if (args.chromium) return args.chromium;
  if (process.env.PLAYWRIGHT_CHROMIUM) return process.env.PLAYWRIGHT_CHROMIUM;
  const root = join(homedir(), ".cache", "ms-playwright");
  if (existsSync(root)) {
    for (const d of readdirSync(root).filter((n) => /^chromium-\d+$/.test(n)).sort().reverse()) {
      const p = join(root, d, "chrome-linux64", "chrome");
      if (existsSync(p)) return p;
    }
  }
  throw new Error("No Chromium found: pass --chromium or set PLAYWRIGHT_CHROMIUM");
}

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];
const results = [];

const browser = await chromium.launch({ executablePath: findChromium(), args: ["--no-sandbox"] });
try {
  for (const theme of themes) {
    for (const width of widths) {
      const context = await browser.newContext({
        viewport: { width, height: width <= 480 ? 812 : 900 },
        colorScheme: theme,
        isMobile: width <= 480,
      });
      const { host } = new URL(base);
      await context.addCookies([{ name: "pp-theme", value: theme, domain: host.split(":")[0], path: "/" }]);
      await context.addInitScript((t) => {
        try { localStorage.setItem("pp-theme", t); } catch {}
      }, theme);

      if (set !== "public" && routes.some((r) => MEMBER.includes(r) || ADMIN.includes(r))) {
        const email = process.env.A11Y_EMAIL;
        const password = process.env.A11Y_PASSWORD;
        if (!email || !password) throw new Error("signed-in scan needs A11Y_EMAIL and A11Y_PASSWORD (local test account)");
        const res = await context.request.post(`${base}/api/auth/login`, { data: { email, password }, headers: { origin: base } });
        if (!res.ok()) throw new Error(`login failed: HTTP ${res.status()}`);
      }

      for (const route of routes) {
        const page = await context.newPage();
        const entry = { route, theme, width, status: 0, finalUrl: "", violations: [], overflow: false, error: null };
        try {
          const resp = await page.goto(base + route, { waitUntil: "networkidle", timeout: 45000 });
          entry.status = resp?.status() ?? 0;
          await page.waitForTimeout(600);
          entry.finalUrl = page.url().replace(base, "") || "/";
          await page.evaluate((src) => { if (!window.axe) (0, eval)(src); }, axeSource);
          const out = await page.evaluate(async (tags) => {
            const r = await window.axe.run(document, { runOnly: { type: "tag", values: tags } });
            return {
              violations: r.violations.map((v) => ({
                id: v.id, impact: v.impact, help: v.help,
                nodes: v.nodes.slice(0, 6).map((n) => ({ target: n.target.join(" "), html: n.html.slice(0, 200), summary: n.failureSummary?.split("\n").slice(1, 3).join(" ") ?? "" })),
                count: v.nodes.length,
              })),
              overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
            };
          }, TAGS);
          entry.violations = out.violations;
          entry.overflow = out.overflow;
        } catch (e) {
          entry.error = String(e.message ?? e).split("\n")[0];
        }
        results.push(entry);
        await page.close();
      }
      await context.close();
    }
  }
} finally {
  await browser.close();
}

if (args.out) writeFileSync(args.out, JSON.stringify(results, null, 2));

const total = results.reduce((n, r) => n + r.violations.reduce((m, v) => m + v.count, 0), 0);
const ruleCounts = {};
for (const r of results) for (const v of r.violations) ruleCounts[v.id] = (ruleCounts[v.id] ?? 0) + v.count;
for (const r of results) {
  const n = r.violations.reduce((m, v) => m + v.count, 0);
  const flags = [r.error ? `ERROR ${r.error}` : "", r.overflow ? "H-OVERFLOW" : "", r.status >= 400 ? `HTTP ${r.status}` : "", r.finalUrl && r.finalUrl !== r.route ? `-> ${r.finalUrl}` : ""].filter(Boolean).join(" ");
  console.log(`${String(n).padStart(3)}  ${r.theme.padEnd(5)} ${String(r.width).padStart(4)}  ${r.route}  ${flags}  ${r.violations.map((v) => `${v.id}×${v.count}`).join(" ")}`);
}
console.log(`\n${results.length} page scans, ${total} violating nodes`);
console.log("By rule:", JSON.stringify(ruleCounts));
process.exitCode = total > 0 || results.some((r) => r.error) ? 1 : 0;
