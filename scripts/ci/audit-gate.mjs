#!/usr/bin/env node
// TASK-017: blocking dependency-audit gate.
//
//   node scripts/ci/audit-gate.mjs
//
// Runs `pnpm audit --prod --json` and exits non-zero when it finds
//   * ANY critical advisory (never allowlistable), or
//   * any high advisory that is not in scripts/ci/audit-allowlist.json (or whose entry has expired).
// Lower severities are listed but do not block. AUDIT_FAIL_LEVEL=critical makes highs
// non-blocking too (default: high). A failure to reach the registry also fails the gate:
// a security check that silently passes when it could not run is worse than none.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const failLevel = process.env.AUDIT_FAIL_LEVEL === 'critical' ? 'critical' : 'high';
const rank = { info: 0, low: 1, moderate: 2, high: 3, critical: 4 };
const today = new Date().toISOString().slice(0, 10);

function runAudit() {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const r = spawnSync('pnpm', ['audit', '--prod', '--json'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    try {
      const parsed = JSON.parse(r.stdout);
      if (parsed && parsed.advisories) return parsed;
    } catch { /* fall through to retry */ }
    console.error(`audit-gate: attempt ${attempt}: no usable audit output (exit ${r.status}). ${(r.stderr || '').split('\n').slice(-3).join(' ')}`);
  }
  console.error('audit-gate: FAIL: could not obtain audit results from the registry');
  process.exit(2);
}

const allow = JSON.parse(readFileSync(join(here, 'audit-allowlist.json'), 'utf8')).allow ?? [];
const audit = runAudit();
const advisories = Object.values(audit.advisories);

const rows = [];
let blocked = 0;
for (const a of advisories.sort((x, y) => rank[y.severity] - rank[x.severity])) {
  if (rank[a.severity] < rank.high) continue;
  const entry = allow.find((e) => e.ghsa === a.github_advisory_id);
  let verdict;
  if (a.severity === 'critical' || rank[a.severity] < rank[failLevel]) {
    verdict = rank[a.severity] < rank[failLevel] ? 'not blocking (AUDIT_FAIL_LEVEL)' : 'BLOCK';
  } else if (entry && entry.expires >= today) {
    verdict = `allowed until ${entry.expires}`;
  } else if (entry) {
    verdict = `BLOCK (allowlist entry expired ${entry.expires})`;
  } else {
    verdict = 'BLOCK';
  }
  if (verdict.startsWith('BLOCK')) blocked++;
  rows.push(`  ${a.severity.padEnd(8)} ${a.github_advisory_id}  ${a.module_name}  ${a.vulnerable_versions} -> ${a.patched_versions}  [${verdict}]`);
}

const counts = audit.metadata?.vulnerabilities ?? {};
console.log(`audit-gate: production dependencies: ${JSON.stringify(counts)}`);
console.log(rows.length ? rows.join('\n') : '  no high or critical advisories');
const stale = allow.filter((e) => !advisories.some((a) => a.github_advisory_id === e.ghsa));
for (const e of stale) console.log(`audit-gate: note: allowlist entry ${e.ghsa} (${e.package}) no longer matches any advisory; remove it`);

if (blocked > 0) {
  console.error(`audit-gate: FAIL: ${blocked} blocking advisor${blocked === 1 ? 'y' : 'ies'}. Fix or upgrade; a high-severity exception needs an owner-approved entry in scripts/ci/audit-allowlist.json.`);
  process.exit(1);
}
console.log('audit-gate: PASS');
