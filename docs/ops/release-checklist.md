# Release checklist

Document 4 TASK-017. A short list to follow for every production release. Rollback detail for the database is in [backups.md](backups.md) and [migrations.md](migrations.md); environment and secret rules in [environments.md](environments.md).

Production is: backend on Render (free plan, Singapore, Docker image from `apps/backend/Dockerfile`, health path `/api/health`), web on Vercel, database on Supabase. Deploy order matters because the backend owns the schema.

## 1. Before merging

- [ ] The pull request is green on the required checks `build`, `secret-scan`, `dependency-audit` ([branch-protection.md](branch-protection.md)). `build` already runs the migration rehearsal, lint, typecheck, builds of backend and web, all tests and the Docker boot test.
- [ ] Locally, if you want it before pushing (local Docker Postgres/Redis only):
  ```bash
  pnpm install --frozen-lockfile
  pnpm turbo run lint typecheck build test
  bash apps/backend/scripts/check-migrations.sh all
  pnpm --filter @packetpulse/backend run test:e2e
  ```
- [ ] Migrations follow the [review checklist](migrations.md#review-checklist): additive, no drop in the same release as the code that stops using it, rollback note written.
- [ ] No secret in the diff; new environment variables are added to `render.yaml`/Vercel **before** the deploy that needs them (the backend refuses to boot on a missing required variable).
- [ ] The latest daily backup is green and under 24 h old (Actions > Database backup). For a release with a non-additive migration, trigger a manual backup run first and wait for it.
- [ ] The dependency-audit allowlist has not expired (`scripts/ci/audit-allowlist.json`).

## 2. Deploy order

1. **Migrate the database first** (backward-compatible migrations only, so the old backend still works against the new schema):
   ```bash
   cd apps/backend
   DATABASE_URL='<direct or session-pooler URL>' node_modules/.bin/prisma migrate status   # read the pending list
   DATABASE_URL='<same>' node_modules/.bin/prisma migrate deploy
   ```
   Only `migrate deploy` against a remote database; never `migrate dev`, `reset` or `db push`. Details: [migrations.md](migrations.md#production-procedure).
2. **Deploy the backend** (merge to `main`; Render builds the Docker image and swaps after the health check passes). Wait until `/api/health` answers 200 on the new version.
3. **Deploy the web app** (Vercel builds on the same merge). Web last, so it never calls an API that does not exist yet. If a release changes an API shape, the backend must accept both old and new for one release.
4. Apply any provider settings changes (Render/Vercel/Supabase dashboards) listed in the pull request.

## 3. Smoke checks (within 15 minutes of deploy)

- [ ] `curl -s https://<backend host>/api/health` returns 200 and `"status":"ok"` (if Render was asleep it may take up to a minute).
- [ ] Web home page loads (200) and shows no console errors; the Uptime workflow's next run is green.
- [ ] Log in with a normal test account; open one page that uses the changed feature.
- [ ] Admin: log in, open the dashboard, check **System status**.
- [ ] Register or request a verification email only if the release touched email (Resend dashboard shows delivery).
- [ ] Render logs show no repeating errors in the first minutes.

## 4. Rollback

Decide quickly; roll back first, investigate after. Tell the incident lead if members are affected ([incident-process.md](incident-process.md)).

| Situation | Action |
|---|---|
| Web broken, backend fine | Vercel: Deployments > previous deployment > **Promote to production** (instant). |
| Backend broken, migration was additive | Render: Deploys > previous deploy > **Rollback**. The old code runs against the new schema (additive migrations allow this by design). |
| Backend broken, migration was destructive or changed data | Roll the code back, then restore data from the last backup ([recovery outline](backups.md#recovering-production-outline)); everything after the backup time is lost, so say so to members. Do not hand-edit `_prisma_migrations`. |
| Bad migration failed half way | `prisma migrate status` shows it as failed; fix forward with a new migration or resolve it deliberately (`prisma migrate resolve`) after checking the actual schema. Never edit a migration that was already applied. |
| Leaked secret | Rotate it at the provider first (JWT secrets log everyone out), then continue the checklist. |

After a rollback: open an incident note, write what was seen, and add the missing test or check before trying the release again.

## 5. After the release

- [ ] Note anything surprising in the pull request; update docs if the procedure changed.
- [ ] If a deferred item was part of the release (for example the zod 4 upgrade), remove its allowlist entry.
