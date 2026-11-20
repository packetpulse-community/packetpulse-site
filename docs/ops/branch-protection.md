# Branch protection for `main`

Document 4 TASK-017. Branch protection is a **repository setting, not code**: it is the owner's decision and nobody applies it from a script without approval. This page gives the exact required check names and the command, for the owner to run or approve.

## Required status checks

GitHub matches required checks by the **job name** shown on the pull request. In `.github/workflows/ci.yml` they are:

| Check name (exact) | What it proves | Blocking? |
|---|---|---|
| `build` | Prisma client, migration rehearsal (fresh, drift, over existing data), lint, typecheck, build of every package (backend, web, types, netsim), migrate + seed, all unit tests (`turbo run test`: backend jest, web vitest, netsim), backend e2e, production Docker image build and boot smoke test | yes |
| `secret-scan` | gitleaks over the full git history | yes |
| `dependency-audit` | `scripts/ci/audit-gate.mjs`: no critical advisory; no high advisory outside the documented, expiring allowlist `scripts/ci/audit-allowlist.json` | yes |

The workflow names are `CI`; the check contexts above are the job ids. A check only becomes selectable after it has run once on the repository.

Not required (informational, scheduled, no PR context): `Uptime`, `Database backup`.

## Proposed rules

| Rule | Proposed value | Why |
|---|---|---|
| Require the three checks above | yes | Nothing reaches `main` red |
| Require branches to be up to date before merging (`strict`) | yes | A green check on a stale branch is not proof for the merge result |
| Require a pull request before merging | yes, **1 approval** | If the team is one person, set approvals to 0 and keep the PR requirement (review by yourself still gives CI a place to run) |
| Dismiss stale approvals on new commits | yes | |
| Include administrators | **owner decides** (proposal: yes after the first stable weeks; `false` keeps an emergency escape hatch) | |
| Allow force pushes / deletions | no / no | History is evidence |
| Require signed commits, linear history | not proposed | Extra friction without a current need |

## The command (do NOT run without the owner's approval)

Requires `gh auth login` as a repository admin. Repository: `packetpulse-community/packetpulse-site`.

```bash
gh api -X PUT repos/packetpulse-community/packetpulse-site/branches/main/protection \
  -H "Accept: application/vnd.github+json" \
  --input - <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["build", "secret-scan", "dependency-audit"]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON
```

Check what is set: `gh api repos/packetpulse-community/packetpulse-site/branches/main/protection`.
Undo: `gh api -X DELETE repos/packetpulse-community/packetpulse-site/branches/main/protection`.

## Limits and notes

- **Plan limit:** on GitHub Free, branch protection and rulesets for **private** repositories need a paid plan (Team/Pro); public repositories get them free. If the command returns `403 Upgrade to GitHub Pro`, either make the repository public, upgrade, or work by convention (merge only when the three checks are green) and say so in the release checklist.
- Rulesets (Settings > Rules > Rulesets) are the newer equivalent with the same three checks; the legacy API above is simpler to document.
- Also enable in repository settings: Dependabot alerts and security updates, secret scanning and push protection (free on public repositories), and "Require approval for first-time contributors" on workflows.
- Scheduled workflows (`Uptime`, `Database backup`) only run from the default branch.
