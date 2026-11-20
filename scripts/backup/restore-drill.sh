#!/usr/bin/env bash
# TASK-004: restore drill. Restores a backup into a THROWAWAY database, verifies it,
# then drops it. Proves a backup is usable and measures how long a restore takes (RTO).
#
#   bash scripts/backup/restore-drill.sh [path/to/packetpulse-<stamp>.dump[.gpg]]
#
# With no argument the newest backup in $BACKUP_DIR (default ./backups) is used.
#
# Where it restores (the safety rules):
#   * By default into the LOCAL docker Postgres, postgresql://packetpulse:packetpulse@localhost:5433/postgres,
#     inside a new database named <prefix>_drill_<stamp>_<pid> that is dropped on exit.
#   * Any host other than localhost / 127.0.0.1 / ::1 is REFUSED unless RESTORE_TARGET_URL is
#     set explicitly, and then it must differ from DATABASE_URL (if that is set): the same
#     connection string, or the same host:port on a remote server, is refused.
#   * It only ever drops the database it created itself, and refuses to start if that name exists.
#   * It never prints a connection string.
#
# Environment:
#   RESTORE_TARGET_URL   admin connection to the server to restore on (database name in the URL is only
#                        used to connect; the drill DB is created next to it). Needs CREATEDB.
#   DATABASE_URL         the production source, only read to enforce the "differs from source" rule
#   BACKUP_PASSPHRASE    needed for .gpg backups
#   BACKUP_DIR           where to look for the newest backup (default ./backups)
#   MIGRATIONS_DIR       repo migrations to compare with (default apps/backend/prisma/migrations)
#                        set to "" to skip that comparison (e.g. a backup older than the repo)
#   DRILL_KEY_TABLES     space-separated tables that must exist
#   DRILL_MIN_USERS      minimum rows expected in "users" (default 1)
#   DRILL_STRICT         1 = a row-count difference from the backup manifest fails the drill
#                        (default: reported as a warning, since the manifest is taken a moment
#                        after the dump's snapshot on a live database)
set -euo pipefail
umask 077

die() { echo "restore-drill: FAIL: $*" >&2; exit 1; }
for t in pg_restore psql createdb sha256sum; do command -v "$t" >/dev/null || die "$t not found"; done

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
MIGRATIONS_DIR="${MIGRATIONS_DIR-$REPO_ROOT/apps/backend/prisma/migrations}"
KEY_TABLES="${DRILL_KEY_TABLES:-users roles permissions user_roles role_permissions refresh_tokens site_settings _prisma_migrations}"
MIN_USERS="${DRILL_MIN_USERS:-1}"
STRICT="${DRILL_STRICT:-0}"
DEFAULT_LOCAL_URL="postgresql://packetpulse:packetpulse@localhost:5433/postgres"
TARGET_URL="${RESTORE_TARGET_URL:-$DEFAULT_LOCAL_URL}"

# --- URL helpers (host, port of a postgres URL; no output of the URL itself) -------------
url_host() { local r='^postgres(ql)?://([^@/]*@)?(\[[^]]+\]|[^:/?]+)'; [[ "$1" =~ $r ]] && echo "${BASH_REMATCH[3]}"; }
url_port() { local r='^postgres(ql)?://([^@/]*@)?(\[[^]]+\]|[^:/?]+):([0-9]+)'; [[ "$1" =~ $r ]] && echo "${BASH_REMATCH[4]}" || echo 5432; }
url_with_db() { # replace/append the database name; keeps query string
  local u="$1" db="$2" base q=""
  [[ "$u" == *\?* ]] && { q="?${u#*\?}"; u="${u%%\?*}"; }
  base="$(sed -E 's#^(postgres(ql)?://[^/]*)(/.*)?$#\1#' <<<"$u")"
  echo "$base/$db$q"
}
is_local_host() { case "$1" in localhost | 127.0.0.1 | "[::1]" | "::1") return 0 ;; *) return 1 ;; esac; }

THOST="$(url_host "$TARGET_URL")" || true
[ -n "$THOST" ] || die "RESTORE_TARGET_URL is not a postgres:// URL"
TPORT="$(url_port "$TARGET_URL")"

if ! is_local_host "$THOST"; then
  [ -n "${RESTORE_TARGET_URL:-}" ] || die "refusing a non-local target without an explicit RESTORE_TARGET_URL"
fi
if [ -n "${DATABASE_URL:-}" ]; then
  [ "$TARGET_URL" != "$DATABASE_URL" ] || die "RESTORE_TARGET_URL is identical to DATABASE_URL (the source); refusing"
  SHOST="$(url_host "$DATABASE_URL" || true)"; SPORT="$(url_port "$DATABASE_URL" || true)"
  if ! is_local_host "$THOST" && [ "$THOST:$TPORT" = "$SHOST:$SPORT" ]; then
    die "the restore target is the same server as DATABASE_URL (the source); refusing"
  fi
fi
echo "restore-drill: target server $THOST:$TPORT ($(is_local_host "$THOST" && echo local || echo EXPLICIT REMOTE))"

# --- locate the backup -----------------------------------------------------------------
BACKUP="${1:-}"
if [ -z "$BACKUP" ]; then
  BACKUP="$(ls -1t "$BACKUP_DIR"/*.dump "$BACKUP_DIR"/*.dump.gpg 2>/dev/null | head -n1 || true)"
fi
[ -n "$BACKUP" ] && [ -f "$BACKUP" ] || die "no backup file found (pass a path or set BACKUP_DIR)"
echo "restore-drill: backup $(basename "$BACKUP") ($(du -h "$BACKUP" | cut -f1))"

WORK="$(mktemp -d)"
DRILL_DB="packetpulse_drill_$(date -u +%Y%m%d%H%M%S)_$$"
CREATED=0
cleanup() {
  rm -rf "$WORK"
  if [ "$CREATED" = 1 ]; then
    psql "$ADMIN_URL" -qc "DROP DATABASE IF EXISTS \"$DRILL_DB\" WITH (FORCE)" >/dev/null 2>&1 \
      && echo "restore-drill: dropped throwaway database $DRILL_DB" \
      || echo "restore-drill: WARNING could not drop $DRILL_DB; drop it by hand" >&2
  fi
}
trap cleanup EXIT

# checksum, then decrypt if needed
if [ -f "$BACKUP.sha256" ]; then
  ( cd "$(dirname "$BACKUP")" && sha256sum --check --status "$(basename "$BACKUP").sha256" ) || die "checksum mismatch: the backup file is corrupt or was altered"
  echo "restore-drill: checksum ok"
else
  echo "restore-drill: no .sha256 next to the backup (checksum not verified)"
fi
DUMP="$BACKUP"
if [[ "$BACKUP" == *.gpg ]]; then
  [ -n "${BACKUP_PASSPHRASE:-}" ] || die "backup is encrypted; set BACKUP_PASSPHRASE"
  DUMP="$WORK/restore.dump"
  gpg --batch --yes --quiet --pinentry-mode loopback --passphrase-fd 3 --output "$DUMP" --decrypt "$BACKUP" 3<<<"$BACKUP_PASSPHRASE" 2>/dev/null \
    || die "decryption failed (wrong BACKUP_PASSPHRASE?)"
  echo "restore-drill: decrypted"
fi
pg_restore --list "$DUMP" >/dev/null 2>&1 || die "pg_restore cannot read the dump (corrupt or not a custom-format dump)"

# --- restore ---------------------------------------------------------------------------
ADMIN_URL="$TARGET_URL"
psql "$ADMIN_URL" -Atqc 'select 1' >/dev/null 2>&1 || die "cannot connect to the restore target server"
exists="$(psql "$ADMIN_URL" -Atqc "select 1 from pg_database where datname = '$DRILL_DB'")"
[ -z "$exists" ] || die "database $DRILL_DB already exists; refusing"
psql "$ADMIN_URL" -qc "CREATE DATABASE \"$DRILL_DB\"" >/dev/null || die "cannot create the throwaway database (needs CREATEDB)"
CREATED=1
DRILL_URL="$(url_with_db "$TARGET_URL" "$DRILL_DB")"

start=$SECONDS
# Restore via SQL script mode so one transaction is applied with ON_ERROR_STOP. The sed drops
# `SET transaction_timeout`, which a pg_dump 17+ client emits but a Postgres 16 server rejects
# (found by the first local drill: client 18 dumping, server 16 restoring). It also drops
# `CREATE SCHEMA public`, which already exists in a new database.
set -o pipefail
pg_restore --no-owner --no-privileges -f - "$DUMP" 2>"$WORK/restore.err" \
  | sed -e '/^SET transaction_timeout = /d' -e '/^CREATE SCHEMA public;/d' \
  | psql "$DRILL_URL" -q -v ON_ERROR_STOP=1 --single-transaction -o /dev/null 2>>"$WORK/restore.err" \
  || { sed -E 's#(postgres(ql)?://)[^[:space:]]+#\1***#g' "$WORK/restore.err" >&2; die "restore failed"; }
elapsed=$((SECONDS - start))
echo "restore-drill: restored into $DRILL_DB in ${elapsed}s"

q() { psql "$DRILL_URL" -Atq -c "$1"; }
fail=0
bad() { echo "restore-drill: CHECK FAILED: $*" >&2; fail=1; }

# 1. key tables
for t in $KEY_TABLES; do
  [ "$(q "select to_regclass('public.\"$t\"') is not null")" = t ] || bad "table $t is missing"
done

# 2. row counts of every table
echo "restore-drill: row counts (restored)"
counts="$(q "select format('%I', c.relname) || ' ' ||
  (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from public.%I', c.relname), false, true, '')))[1]::text
  from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname='public' and c.relkind='r' order by 1")"
printf '%s\n' "$counts" | awk '{printf "    %-34s %s\n", $1, $2}'
users="$(awk '$1=="users"{print $2}' <<<"$counts")"
[ "${users:-0}" -ge "$MIN_USERS" ] || bad "users has ${users:-0} rows, expected at least $MIN_USERS"

MANIFEST="${BACKUP%.gpg}.manifest"
if [ -f "$MANIFEST" ]; then
  diffs="$(diff <(grep -v '^#' "$MANIFEST" | sort) <(printf '%s\n' "$counts" | sort) || true)"
  if [ -n "$diffs" ]; then
    echo "restore-drill: row counts differ from the backup manifest (expected if the database changed while it was dumped):"
    echo "$diffs" | sed 's/^/    /'
    [ "$STRICT" != 1 ] || bad "row counts differ from the manifest and DRILL_STRICT=1"
  else
    echo "restore-drill: row counts match the backup manifest"
  fi
fi

# 3. migrations table
if [ "$(q "select to_regclass('public._prisma_migrations') is not null")" = t ]; then
  unfinished="$(q "select count(*) from _prisma_migrations where finished_at is null or rolled_back_at is not null")"
  [ "$unfinished" = 0 ] || bad "$unfinished migration(s) unfinished or rolled back in _prisma_migrations"
  if [ -n "$MIGRATIONS_DIR" ] && [ -d "$MIGRATIONS_DIR" ]; then
    mdiff="$(diff <(q "select migration_name from _prisma_migrations order by 1") \
                  <(find "$MIGRATIONS_DIR" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort) || true)"
    if [ -n "$mdiff" ]; then
      echo "$mdiff" | sed 's/^/    /' >&2
      bad "_prisma_migrations does not match $MIGRATIONS_DIR ('<' only in backup, '>' only in repo)"
    else
      echo "restore-drill: _prisma_migrations matches the repo ($(q 'select count(*) from _prisma_migrations') migrations)"
    fi
  else
    echo "restore-drill: migrations directory comparison skipped"
  fi
fi

if [ "$fail" = 0 ]; then
  echo "restore-drill: PASS (restore took ${elapsed}s)"
else
  die "one or more checks failed"
fi
