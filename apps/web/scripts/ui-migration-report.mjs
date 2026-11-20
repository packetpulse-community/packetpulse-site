#!/usr/bin/env node
// Prints the Signal Grove migration checklist as Markdown:
//   - every route group with its status (read from src/shared/theme/legacy-routes.ts)
//   - the number of remaining hard-coded colour classes per feature / area
//
// Re-run:   node apps/web/scripts/ui-migration-report.mjs > docs/research/13-ui-migration-checklist.md
// (the file's own header is added by this script, so the output replaces the whole document)

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(webRoot, "src");

// Tailwind palette colours and black/white, with any variant prefix (dark:, hover:, md:...).
const PALETTE =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const UTILITIES = "bg|text|border|from|to|via|ring|fill|stroke|shadow|divide|outline|decoration|placeholder|accent|caret";
const HARD_CODED = new RegExp(
  String.raw`(?<![\w-])(?:[a-z0-9-]+:)*(?:${UTILITIES})-(?:(?:${PALETTE})-\d{2,3}|white|black)(?:\/\d+)?(?![\w-])`,
  "g",
);
// The old glass recipe also counts: it only looks right on a dark ground.
const GLASS = /(?<![\w-])(?:glass-panel(?:-strong)?|glass-interactive|bg-glass|border-glass|shadow-glass(?:-glow)?)(?![\w-])/g;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx|ts|css)$/.test(name) && !/\.test\./.test(name)) out.push(full);
  }
  return out;
}

function count(files) {
  let classes = 0;
  const withHits = new Set();
  for (const f of files) {
    const text = readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*(?:\/\/|\*).*$/gm, "");
    const n = (text.match(HARD_CODED)?.length ?? 0) + (text.match(GLASS)?.length ?? 0);
    if (n > 0) {
      classes += n;
      withHits.add(f);
    }
  }
  return { classes, files: withHits.size, total: files.length };
}

// Areas: each features/* folder, plus the shared layer and the app routes folder.
const areas = [];
for (const name of readdirSync(join(src, "features")).sort()) {
  if (!statSync(join(src, "features", name)).isDirectory()) continue;
  areas.push({ name: `features/${name}`, files: walk(join(src, "features", name)) });
}
areas.push({ name: "shared (excluding styles)", files: walk(join(src, "shared")).filter((f) => !f.includes("/styles/")) });
areas.push({ name: "app (route files)", files: walk(join(src, "app")) });

// Which routes each feature serves (documentation only).
const FEATURE_ROUTES = {
  "features/admin": "/admin/*",
  "features/auth": "/login /register /forgot-password /verify-email",
  "features/blogs": "/blogs, /blogs/[slug]",
  "features/categories": "/admin/categories",
  "features/dashboard": "/dashboard",
  "features/design-system": "/design-system",
  "features/forums": "/forums, /forums/[id]",
  "features/landing": "/, /about, /contact (and Navbar/Footer, migrated)",
  "features/network-tools": "/network-tools",
  "features/notifications": "/notifications, /settings/notifications",
  "features/packet-lab": "/tools/packet-lab/*",
  "features/profile": "/profile",
  "features/quizzes": "/quizzes/*, /certificates",
  "features/recordings": "/recordings/*",
  "features/resources": "/resources/*",
  "features/skills": "/profile, /admin/taxonomy",
};

// Route groups come from the registry so this report can never disagree with the app.
const registry = readFileSync(join(src, "shared/theme/legacy-routes.ts"), "utf8");
const groups = [...registry.matchAll(/\{ id: "([^"]+)", label: "([^"]+)", prefixes: \[([^\]]*)\], status: "(\w+)", scope: "(\w+)" \}/g)].map(
  (m) => ({ id: m[1], label: m[2], prefixes: [...m[3].matchAll(/"([^"]+)"/g)].map((p) => p[1]), status: m[4], scope: m[5] }),
);

const today = new Date().toISOString().slice(0, 10);
const lines = [];
lines.push("# 13. UI migration checklist (Signal Grove)", "");
lines.push(`Generated ${today} by \`apps/web/scripts/ui-migration-report.mjs\`. Do not edit the tables by hand; re-run:`, "");
lines.push("```bash", "node apps/web/scripts/ui-migration-report.mjs > docs/research/13-ui-migration-checklist.md", "```", "");
lines.push(
  "Grove is the default theme and light is the default mode. Route groups marked **legacy** still contain hard-coded",
  "dark glass classes, so they render inside a scoped dark surface (`data-legacy-dark`, see `shared/theme/LegacyScope.tsx`).",
  "",
  "## How to migrate a route group",
  "",
  "1. Restyle the group's screens with the semantic Tailwind names: `bg-background`, `bg-surface`, `bg-surface-subtle`,",
  "   `border-border`, `text-text`, `text-text-secondary`, `bg-primary`, `text-primary-text`, `bg-accent` (lime), and the",
  "   state names `success`, `warning`, `danger`, `info` (each with `-soft`). Shared primitives already follow the theme.",
  "2. Check the screen in Light and Dark and at mobile width.",
  "3. In `apps/web/src/shared/theme/legacy-routes.ts` change that group's `status` from `\"legacy\"` to `\"migrated\"`.",
  "   That removes the dark surface for exactly those routes; no layout edit is needed.",
  "4. Re-run the command above. The count for the feature should be 0.",
  "",
  "`scope` tells what goes dark while a group is legacy: **page** = the whole page (public pages and auth screens),",
  "**content** = only the content area inside the app shell (the sidebar, top bar and tab bar stay themed).",
  "",
  "## Route groups",
  "",
  "| Route group | Routes | Status | Dark scope while legacy |",
  "| --- | --- | --- | --- |",
);
for (const g of groups) {
  lines.push(`| ${g.label} | ${g.prefixes.map((p) => `\`${p}\``).join(" ")} | ${g.status === "migrated" ? "migrated" : "**legacy**"} | ${g.status === "migrated" ? "none" : g.scope} |`);
}
lines.push("", "Shell and chrome (always themed, both modes): app sidebar, top bar, mobile tab bar and More sheet, command palette,",
  "breadcrumbs, admin sidebar and top bar, public Navbar and Footer, shared primitives, status/error screens, `/design-system`.", "");
lines.push("## Remaining hard-coded colour classes", "");
lines.push(
  "Counts palette utilities (`bg-indigo-600`, `text-white`, `dark:border-slate-800`, `from-slate-900` ...) and the old",
  "`glass-*` recipe classes in `.tsx`, `.ts` and `.css` files (comments and tests excluded).",
  "",
  "| Area | Serves | Classes | Files with hits | Files |",
  "| --- | --- | ---: | ---: | ---: |",
);
let totalClasses = 0;
for (const a of areas) {
  const c = count(a.files);
  totalClasses += c.classes;
  lines.push(`| \`${a.name}\` | ${FEATURE_ROUTES[a.name] ?? ""} | ${c.classes} | ${c.files} | ${c.total} |`);
}
lines.push(`| **Total** | | **${totalClasses}** | | |`, "");
console.log(lines.join("\n"));
