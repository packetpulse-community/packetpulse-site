# Migration review (all existing migrations)

Document 4 TASK-007. Reviewed 2026-11-20 against `apps/backend/prisma/migrations` (12 migrations). Every migration was also applied from an empty database, and the last four over fixture data, by `bash apps/backend/scripts/check-migrations.sh all` (see [migrations.md](migrations.md)). Tested on PostgreSQL 16 (local docker); the production Supabase Postgres version was **not** checked, see "Not verified".

Terms: **additive** = only adds things old code ignores; **destructive** = drops or rewrites data or structure, cannot be undone from the migration alone; **data-changing** = UPDATE/backfill of existing rows. "Lock risk" is what matters on a large table; today every table is small, so none of this has hurt yet.

All of these are **history**: the first ten were already applied to Supabase when this review was written (the tracker records the live database as migrated), so the verdict column says what to do if you meet the same pattern again, and whether a fresh database (staging, a restore) can safely replay it.

## Summary table

| # | Migration | Kind | Lock / downtime risk | Backfill | Verdict |
|---|---|---|---|---|---|
| 1 | `20260813064154_init_identity` | additive (creates users, roles, tokens, RBAC tables, 1 enum) | none, empty database | no | Safe |
| 2 | `20260813071643_content_domains` | additive (blogs, resources, recordings and join tables, 4 enums) | none, new tables | no | Safe |
| 3 | `20260813095056_forums_quizzes` | additive (forums, quizzes, attempts, certificates, 2 enums) | none, new tables | no | Safe |
| 4 | `20260813101640_notifications` | additive (1 table, 1 enum, 1 index) | none | no | Safe |
| 5 | `20260815123355_blog_moderation_and_activity_log` | additive, but touches an existing table: `blog_posts ADD COLUMN is_approved BOOLEAN NOT NULL DEFAULT true` plus an index | ADD COLUMN with a constant default is metadata-only on PG 11+ (no rewrite). `CREATE INDEX` (not CONCURRENTLY) blocks writes to `blog_posts` while it builds: seconds at this size | no (default fills it) | Safe at current size. For a big table use `CREATE INDEX CONCURRENTLY` in its own migration |
| 6 | `20260907142042_site_settings_and_client_logs` | additive (2 tables, 1 enum) | none | no | Safe |
| 7 | `20260907173521_unapprove_activity_actions` | additive: `ALTER TYPE ... ADD VALUE` x3 | ADD VALUE takes a brief lock on the type. The new values cannot be *used* in the same transaction that adds them (nothing here uses them) | no | Safe. **Flag: ADD VALUE is irreversible** (an enum value cannot be removed without rebuilding the type) |
| 8 | `20260910101403_password_hash_nullable` | loosens a constraint: `users.password_hash DROP NOT NULL` | metadata-only, instant (brief ACCESS EXCLUSIVE) | no | Safe for the database. Code that assumes a hash exists must handle NULL; the local provider already does (`storedPasswordHash ? ... : false`) |
| 9 | `20260912150350_shared_categories` | **destructive + data-changing**: new `categories` table, seed rows, adds `category_id`, backfills four tables, sets NOT NULL, adds FKs, **drops** the `category` column on four tables, **drops** three enum types and the `forum_categories` table, re-points `forum_threads` | `UPDATE` on four tables, `SET NOT NULL` (full scan) and `DROP COLUMN` / `DROP TABLE` take ACCESS EXCLUSIVE locks; on large tables this blocks reads and writes for the duration of the scans. Runs as one script, so a failure rolls the whole thing back | **Yes, in the same migration**, with a guard that raises if any row failed to map | **Risky pattern, already applied.** Rehearsed over data: counts preserved, `network_automation` mapped to `network-automation`, threads re-pointed. Correct on a copy, but it violates expand-then-contract: the old enum columns were dropped in the release that introduced the new ones, so old app code cannot run against the new schema and there is no rollback without a backup. Do not repeat this shape; see the checklist in migrations.md |
| 10 | `20260912150500_activity_log_forum_quiz_actions` | additive: `ALTER TYPE ... ADD VALUE` x8 | as #7 | no | Safe. **Flag: ADD VALUE, irreversible.** Its own file on purpose (comment in the SQL) |
| 11 | `20261116100000_audit_log_append_only` | additive structure **plus a behaviour change**: 4 `ADD VALUE`, `ADD COLUMN reason TEXT` (nullable), 2 trigger functions, 2 triggers on `admin_activity_logs` | `ADD COLUMN` nullable is instant. `CREATE TRIGGER` takes SHARE ROW EXCLUSIVE briefly (blocks concurrent writes to that table for a moment). The trigger adds a small cost to every update/delete of the table, and the table is write-once, so negligible | no (old rows keep `reason = NULL`) | **Safe to apply**, with one flag: from this point **every UPDATE, DELETE and TRUNCATE on `admin_activity_logs` fails** except the single `actor_id -> NULL` change. Rehearsed over 4 existing rows: applies cleanly, rows kept, deleting the actor user still works (`ON DELETE SET NULL` passes the trigger). Consequences: no retention purge or manual clean-up of that table is possible without dropping the triggers; `TRUNCATE users CASCADE` fails because it cascades to this table; test helpers must not clear it (`test/audit-log.e2e-spec.ts` covers the rules). Rolling back needs `DROP TRIGGER` x2 and `DROP FUNCTION` x2 (the enum values and column can stay) |
| 12 | `20261116175303_private_files` | additive: 3 enums, `stored_files`, `file_access_logs`, 4 indexes, 1 FK, append-only trigger on the new `file_access_logs` | none, new empty tables. `file_access_logs.actor_id` has **no** foreign key by design, so deleting a user never needs to modify the append-only table | no | Safe. Flag: `file_access_logs` rejects every UPDATE/DELETE, so a user's access-log rows can never be erased (a GDPR erasure request must be handled by policy, not by deleting rows; see the threat model) |

## Things to watch for in production

1. **`ALTER TYPE ... ADD VALUE`** (#7, #10, #11): fine on PG 12+ inside the migration script, never reversible, and the value must not be used until the migration has committed. Keep each in a migration that does nothing else risky, as #10 did.
2. **New triggers** (#11, #12): they change what the database *accepts*. Anything that wrote to those tables with UPDATE/DELETE (scripts, support queries, a future retention job) now fails. Search the code and runbooks before shipping a trigger. At review time the only code paths are `create` calls and the e2e test that proves refusal.
3. **Column and table drops** (#9): the only destructive migration in the history. It is why the checklist forbids drops in the same release as the code change.
4. **`SET NOT NULL` on a populated table** (#9): scans the table under an exclusive lock. On a big table, add a `CHECK (col IS NOT NULL) NOT VALID`, `VALIDATE CONSTRAINT`, then `SET NOT NULL`.
5. **Non-concurrent indexes** (#5, #9, #12): fine now; at large size use `CREATE INDEX CONCURRENTLY` (it cannot run inside a transaction block, so it needs its own migration and a hand-edited file).
6. **Nothing runs `prisma migrate deploy` automatically.** `apps/backend/Dockerfile` starts `node dist/main.js` and `render.yaml` has no pre-deploy command, so a schema change reaches Supabase only when someone runs the deploy step by hand. A release that includes a migration must say so; see the production procedure in migrations.md.

## Verified and not verified

Verified here: all 12 apply in order from empty; the seed runs after them; `schema.prisma` matches the result (no drift); migrations #9 to #12 apply over fixture rows and the row-level assertions pass (`scripts/migration-fixtures/post-checks.sql`).

Not verified:
- The live Supabase database's applied-migrations list and PostgreSQL version (nobody ran this against it, by rule). Run `prisma migrate status` against it from a trusted shell before the next release.
- Timing on realistic row counts: the fixtures are a dozen rows. The lock notes above are from how Postgres behaves, not from measuring a large table.
- Migrations #1 to #8 over data: they were only run from empty. They were applied to production long ago and replay on every fresh database.
