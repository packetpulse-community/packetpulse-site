# Database migrations and background work

Document 4 TASK-007 (TEST-009). Prisma migrations live in `apps/backend/prisma/migrations/<timestamp>_<name>/migration.sql` and are plain SQL, reviewed in the pull request like code. The history so far is reviewed in [migration-review.md](migration-review.md).

## Rules

1. **Local only: `prisma migrate dev`.** It creates migrations and may reset the database. Run it only against the docker Postgres (`localhost:5433`).
2. **Remote databases (staging, production): only `prisma migrate deploy`.** It applies pending migrations in order and nothing else. Never run `migrate dev`, `migrate reset`, `db push` or `db execute` against a remote database, and never edit a migration that has been merged (history; Prisma stores a checksum). Fix forward with a new migration.
3. **A schema change without a migration fails CI** (drift check below).
4. **Staging and production databases are separate** ([environments.md](environments.md)); rehearse on the throwaway database first, then staging, then production.

## Creating a migration

From `apps/backend`, with the docker database up (`docker compose up -d` in the repo root):

```bash
env DATABASE_URL=postgresql://packetpulse:packetpulse@localhost:5433/packetpulse \
  node_modules/.bin/prisma migrate dev --create-only --name add_thing
```

`--create-only` writes the SQL without applying it, so you can read and edit it first (Prisma cannot generate data backfills or `CONCURRENTLY` indexes). Review it with the checklist, then apply it locally with `prisma migrate dev` and commit `schema.prisma` and the migration folder together.

## Review checklist

Copy into the pull request description:

- [ ] **Additive first.** New tables, nullable columns or columns with a constant default, new indexes. Old app code keeps working against the new schema.
- [ ] **Expand, then contract.** Rename or replace in three steps over separate releases: (1) add the new column/table and write to both, (2) move reads and backfill, (3) drop the old one in a later release once nothing reads it. `20260912150350_shared_categories` did all three at once; do not copy it.
- [ ] **No drops in the same release** as the code that stops using the thing dropped.
- [ ] **Backfills are a separate step** (their own migration or script), batched on big tables, with a guard that fails loudly if rows are left unmapped.
- [ ] **Locks.** No `SET NOT NULL`, type change, non-concurrent index or FK validation on a large table without a plan (`CHECK ... NOT VALID` then `VALIDATE`, `CREATE INDEX CONCURRENTLY`). `ALTER TYPE ... ADD VALUE` goes in its own migration and the new value is not used in it; it cannot be undone.
- [ ] **New triggers / constraints** are searched for in the code and runbooks: what used to be allowed that now fails?
- [ ] **Rollback note** in the pull request: how to undo it (usually "restore the backup" for destructive steps; `DROP` of what was added for additive ones). Take a Supabase backup/point-in-time marker before any production migration that is not purely additive.
- [ ] `bash apps/backend/scripts/check-migrations.sh all` passes locally.
- [ ] If the migration changes existing rows or needs data to exist, extend `scripts/migration-fixtures/baseline-data.sql` / `post-checks.sql` so the copy rehearsal covers it.

## Rehearsing on a copy

```bash
bash apps/backend/scripts/check-migrations.sh          # fresh: empty db -> every migration -> seed -> drift check
bash apps/backend/scripts/check-migrations.sh copy     # fixtures at an old baseline -> remaining migrations -> assertions
bash apps/backend/scripts/check-migrations.sh all      # both (what CI runs)
```

The script uses `DATABASE_URL` for the server and credentials (default: the local docker Postgres), creates `packetpulse_migcheck_<mode>_<timestamp>_<pid>`, and drops it when it finishes, also on failure. It refuses any host that is not `localhost`, `127.0.0.1`, `::1` or `postgres`, and it never reads `.env`. The database named in `DATABASE_URL` is never migrated or modified, only used to issue `CREATE/DROP DATABASE`. Needs `psql` and `node` on the PATH and a role allowed to create databases (the docker and CI `packetpulse` role is).

- **fresh** proves the history replays and that `prisma/schema.prisma` equals the migrated database (`prisma migrate diff --exit-code`; non-zero means "you edited the schema without a migration").
- **copy** applies migrations up to `BASELINE_MIGRATION` (default `20260910101403_password_hash_nullable`, an environment variable), loads the fixture rows, applies everything after it with the real `migrate deploy`, and asserts the rows survived, the category backfill mapped correctly, and the audit log is append-only yet deleting a user still works. Newer migrations are rehearsed automatically as part of "everything after the baseline".

Add a package script later with `"check:migrations": "bash scripts/check-migrations.sh all"` (not added yet to avoid clashing with other dependency edits in `apps/backend/package.json`).

## Production procedure

1. Merge only with a green pipeline (CI runs the rehearsal above).
2. Announce the release as "includes a migration". Take a backup / note the point-in-time-recovery time in Supabase.
3. From a trusted machine or a deploy job, with `DATABASE_URL` set to the **direct** Supabase connection (not the transaction pooler; Prisma migrations use advisory locks and prepared statements):
   ```bash
   cd apps/backend
   node_modules/.bin/prisma migrate status    # lists pending migrations; read it
   node_modules/.bin/prisma migrate deploy    # applies pending migrations in order
   ```
4. Deploy the backend **after** the migration succeeded (additive migrations), so new code finds its columns. Destructive steps (drops) go in a later release after the code that stopped using them is live.
5. If `migrate deploy` fails halfway: do not edit the migration. Read the error, run `prisma migrate status`; a failed migration is recorded as failed and blocks further ones. Fix by restoring, or `prisma migrate resolve --rolled-back <name>` only after you have confirmed by hand what was and was not applied, then ship a corrected new migration.
6. Nothing applies migrations on deploy today (`Dockerfile` starts the app only; `render.yaml` has no pre-deploy command). Adding `prisma migrate deploy` as a Render pre-deploy command is a reasonable next step, but it needs the staging environment first.

## Background work

Checked in the code on 2026-11-20 (see also [background-jobs.md](background-jobs.md)).

**Runs in BullMQ workers, outside the request path** (`apps/backend/src/modules/notifications`):
- *Every email*: callers only enqueue through `EmailQueueService` (`email-queue.service.ts`); verification, approval, welcome, password reset OTP and changed notices, security alerts and new-content announcements are all sent by `EmailProcessor` on the `email` queue with retries and backoff. The mailer is not called from a controller or service directly (`MailerService` is only used by the processor).
- *Notification fan-out*: `NotificationsService.notify` enqueues onto the `fanout` queue; `FanoutProcessor` writes the `notifications` row and pushes over the socket.
- Jobs live in Redis, so they outlive the request and a backend restart; job ids are derived from an idempotency key so the same logical job is not duplicated. Shutdown hooks are enabled (`app.enableShutdownHooks()` in `main.ts`), so workers close cleanly on deploy.

**Still runs inline in the request** (candidates to move when they grow):
- Password hashing: `bcrypt` cost 12 on login, register and password change (CPU-bound, tens to a few hundred ms).
- File completion scan in `FilesService.complete`: reads the first bytes of the object and runs the signature scanner before replying (`files.service.ts`). Fine for a signature check; a real virus scanner (ClamAV) must be a job.
- Database work for admin bulk actions and analytics queries.
- Network tools (`network-tools.service.ts`): deterministic simulation in process, no real probing.
- Config/CAPTCHA verification calls made while handling the request.

**Does not exist yet:** parsing hooks (there are none in the backend; the packet simulator in `packages/netsim` is a library used synchronously), scheduled jobs (no `@Cron`/repeatable jobs: expiry checks and retention purges are later tasks), and a separate worker process. Workers run inside the web process (`NotificationsModule`), so a CPU-heavy job would still compete with requests; move them to a dedicated process before adding heavy jobs.
