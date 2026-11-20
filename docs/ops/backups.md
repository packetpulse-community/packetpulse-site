# Backups and the restore drill

Document 4 TASK-004 (OPS-01). Supabase is on the **free plan, which has no automated, downloadable backups and no point-in-time recovery**. Until the plan changes, the only backup is the one we make ourselves. Everything below is built from `scripts/backup/` and `.github/workflows/backup.yml`.

## Targets (proposals: the owner confirms or changes them)

| Target | Proposal | Why it is achievable |
|---|---|---|
| **RPO** (data we can afford to lose) | **24 hours** | One backup a day. Anything written after the last backup and before a disaster is lost. |
| **RTO** (time to be back up) | **4 hours** | Provision/point a database, restore (minutes at today's size, see the drill), run migrations, redeploy, smoke-check. Mostly human reaction time. |
| Retention | 14 daily backups (artifact) and the newest 3 always kept | Covers a bug noticed within two weeks. Longer history needs off-site storage with a lifecycle rule. |
| Drill | Monthly, and after any change to the backup scripts | A backup nobody restored is a hope, not a backup. |

If 24 h RPO is too much, run the workflow more often (edit the cron) or upgrade Supabase (Pro has daily backups, PITR is an add-on). Say which in the owner decisions below.

## What is backed up

- **`pg_dump` of the `public` schema** of the production database: all application tables and the `_prisma_migrations` history. Custom format (compressed), no owners or privileges so it restores into any role.
- Encrypted with `gpg` (AES256, symmetric) when `BACKUP_PASSPHRASE` is set. **The workflow refuses to run without it**: the dump holds personal data (names, emails, IP addresses, hashed passwords).
- Next to each dump: a `.sha256` (integrity) and a `.manifest` (row counts at backup time).
- **Not** backed up: Supabase `auth`/`storage` schemas and Supabase Storage objects. Today the app uses its own tables for identity; if Supabase Auth or Storage ever holds real data, extend `BACKUP_SCHEMAS` and add an object-storage backup. Redis holds only rate-limit and queue state and is not backed up. Secrets live in Render/Vercel and the owner's password manager; they are not in the dump.

## Run it yourself

Needs `pg_dump`, `pg_restore`, `psql` (PostgreSQL client, major version at least the server's) and `gpg`.

```bash
# back up (writes ./backups, git-ignored; encrypted because a passphrase is set)
DATABASE_URL='postgresql://...' BACKUP_PASSPHRASE='long random passphrase' bash scripts/backup/backup.sh
```

```bash
# drill: restore the newest backup into a throwaway database on the LOCAL docker Postgres, verify, drop
BACKUP_PASSPHRASE='long random passphrase' bash scripts/backup/restore-drill.sh
```

`backup.sh` variables: `DATABASE_URL` (required), `BACKUP_DIR`, `BACKUP_PASSPHRASE`, `BACKUP_SCHEMAS` (default `public`), `BACKUP_RETENTION_DAYS` (14), `BACKUP_KEEP_MIN` (3). It never prints the connection string.

`restore-drill.sh` safety rules:

- Restores only into a **new** database named `packetpulse_drill_<time>_<pid>` and drops it afterwards.
- Default target is the local docker Postgres (`localhost:5433`). A non-local target is **refused** unless `RESTORE_TARGET_URL` is set explicitly, and then it must not be the same connection string, nor the same remote server, as `DATABASE_URL`.
- Verifies the checksum, then checks: the key tables exist, `users` has rows (`DRILL_MIN_USERS`), row counts against the manifest (warning only; `DRILL_STRICT=1` fails), `_prisma_migrations` has no unfinished/rolled-back rows **and equals the repo's `apps/backend/prisma/migrations` folder** (set `MIGRATIONS_DIR=` to skip when the backup is older than the repo).
- Prints the restore time: that is your measured RTO ingredient.

**Production dumps are personal data.** Do the drill on your own machine or in CI only, never copy a production dump to a shared drive, chat or a staging environment (see the hard rules in [environments.md](environments.md)), and delete the local copy when done.

## Scheduled backup (GitHub Actions)

`.github/workflows/backup.yml` runs daily at 20:17 UTC (01:47 IST) and on demand (Actions tab, "Database backup", Run workflow). Steps: install the PostgreSQL client, back up, **restore the fresh dump into a throwaway Postgres service container and verify it** (an automatic drill on every run), upload, optional heartbeat. If `BACKUP_DATABASE_URL` is not set the run **skips with a notice and succeeds**; if it is set without `BACKUP_PASSPHRASE` it fails on purpose. Any failure turns the run red, which GitHub emails to the repository's watchers.

### What the owner must configure

Repository **Settings > Secrets and variables > Actions**.

| Kind | Name | Value | Required |
|---|---|---|---|
| Secret | `BACKUP_DATABASE_URL` | Postgres URL of the production database. **Use the Session-mode pooler string** (the same one the backend uses): Supabase's direct host is IPv6-only and GitHub runners are IPv4-only; the transaction pooler (port 6543) cannot run `pg_dump`. Better: create a dedicated read-only role for backups (`GRANT pg_read_all_data`) and use its URL, so a leaked secret cannot write. | yes |
| Secret | `BACKUP_PASSPHRASE` | A long random passphrase. **Store a copy in the owner's password manager: without it every backup is unreadable.** Rotating it makes older backups need the old one. | yes |
| Variable | `BACKUP_STORE` | `artifact` (default), `s3` or `both` | no |
| Variable | `BACKUP_RETENTION_DAYS` | Artifact retention, 1-90 (default 14) | no |
| Variable | `PG_CLIENT_VERSION` | Must be **at least** the Supabase server's major version (default 17). Check the project's Postgres version in the Supabase dashboard. | no |
| Secrets | `BACKUP_S3_BUCKET`, `BACKUP_S3_ACCESS_KEY_ID`, `BACKUP_S3_SECRET_ACCESS_KEY`, `BACKUP_S3_ENDPOINT`, `BACKUP_S3_REGION` | Off-site copy to any S3-compatible bucket (Cloudflare R2 and Backblaze B2 have free tiers). Omit the endpoint for AWS. | for `s3`/`both` |
| Secret | `BACKUP_HEARTBEAT_URL` | A [Healthchecks.io](https://healthchecks.io) (or similar) ping URL. It alerts when a backup does **not** run, which GitHub itself will not tell you. | recommended |

**Decision for the owner: where do backups live?** Artifacts are the zero-setup default but are tied to the same GitHub account as the code, expire after at most 90 days, and a repo deletion removes them. A second, independent copy (R2/B2 bucket, or a periodic download to the owner's disk) is strongly recommended before launch. The workflow does not prune the bucket: set a lifecycle rule (for example expire after 30 days).

To fetch a backup from an artifact: Actions > the run > Artifacts, or `gh run download <run-id> -n packetpulse-db-backup-<run-id>`.

### Free-tier limits to know

- **Supabase free:** no backups to download, no PITR, project **pauses after 1 week of inactivity** (the uptime workflow's health check touches the database, which helps), 500 MB database. A paused or deleted free project loses its data, so the off-site copy matters.
- **GitHub Actions:** private repositories get 2,000 free minutes a month (public: unlimited). The daily backup uses roughly 3-5 minutes. Artifact storage is capped (500 MB on the free plan): a 14-day window of small dumps fits; check the size as the database grows.
- **Scheduled workflows** are best-effort (a run may start late or be skipped under load) and **GitHub disables them after 60 days without repository activity**. The heartbeat catches both.
- **Render free:** has no database of its own here and a service that sleeps; irrelevant to backups except that nothing on Render stores a copy.

## Monthly drill checklist

Put the date and result in the log table below each time.

1. Get the newest backup (artifact download or bucket) onto your own machine. Check the file's age is under 24 h (RPO).
2. `bash scripts/backup/restore-drill.sh path/to/dump.gpg` with `BACKUP_PASSPHRASE` set, against the local docker Postgres (`docker compose up -d postgres`).
3. Result must be `PASS`. Read the row counts: do they look like production (members, resources)?
4. Note the restore time and the dump size.
5. Optional deeper check: point a local backend at the restored database (it is dropped at the end, so run the restore by hand with `pg_restore` into a scratch database) and log in with a test account.
6. Delete the downloaded dump.
7. Confirm the daily workflow ran green on each of the last 7 days and the heartbeat is alive.
8. If anything failed, it is an incident (SEV2 in [incident-process.md](incident-process.md)): fix before the next backup is due.

### Recovering production (outline)

1. Decide the incident lead and open an incident note ([incident-process.md](incident-process.md)).
2. Provision an empty Postgres (new Supabase project or restored project), set `PLATFORM_MODE`/`DATABASE_URL` for it.
3. `gpg` decrypt, `pg_restore --no-owner --no-privileges --dbname=<new url> dump` (or use the same SQL-script path as the drill script).
4. Run `prisma migrate deploy` (applies migrations newer than the backup).
5. Point Render's `DATABASE_URL` at it, redeploy, smoke-check ([release-checklist.md](release-checklist.md)). Refresh tokens in the dump stay valid; if the dump may be compromised, rotate the JWT secrets.
6. Tell members what is lost: everything after the backup timestamp.

## Drill log

| Date | Backup used | Source | Restored into | Restore time | Result | By |
|---|---|---|---|---|---|---|
| 2026-11-21 | `packetpulse-20261120T191425Z.dump.gpg` (88 KB, encrypted) | **Local docker Postgres 16** (`localhost:5433/packetpulse`: 108 users, 14 migrations), pg_dump 18.2 client | Throwaway DB on the same local docker Postgres | 1 s | **PASS** (checksum ok, decrypt ok, 8 key tables present, 43 tables with row counts equal to the manifest, `_prisma_migrations` 14 = repo) | TASK-004 implementation |

Not yet done: **a drill with a real production dump**. The remote Supabase database was deliberately never touched while building this, so the scripts are proven against the local database only. The first owner-run drill must happen right after `BACKUP_DATABASE_URL` is configured.

### What the local proof found and showed

- **Real bug found and fixed:** a pg_dump 17+/18 client writes `SET transaction_timeout`, which a Postgres 16 server rejects (`unrecognized configuration parameter`). The drill now restores through `pg_restore -f -` filtered by `sed` into `psql --single-transaction`, which also removes `CREATE SCHEMA public` (exists in a fresh database). The same applies to restoring a Supabase (Postgres 17) dump into the local Postgres 16: a major version **newer** than the target is the case this handles.
- **The migration comparison works:** a first run failed with `20261121090000_audit_actions_categories_deletions` "only in repo" because the local database had not applied a migration that another session had just added. This is exactly what the check is for.
- **Safety rules exercised:** target equal to source URL refused; same remote server as source refused; wrong passphrase refused (`decryption failed`); a modified backup refused (`checksum mismatch`); an unreachable `DATABASE_URL` fails with a message that does not echo the URL; the throwaway database is dropped on every exit path (verified after failures too).
- Retention pruning: with five old fake backups and `BACKUP_KEEP_MIN=3`, the three oldest past 14 days were removed and the newest backups kept.
