#!/usr/bin/env bash
# TASK-007 / TEST-009: rehearse the Prisma migrations on a THROWAWAY database.
#
#   bash apps/backend/scripts/check-migrations.sh            # mode "fresh" (default)
#   bash apps/backend/scripts/check-migrations.sh fresh
#   bash apps/backend/scripts/check-migrations.sh copy       # migrations over existing data
#   bash apps/backend/scripts/check-migrations.sh all        # both
#
# fresh: empty database -> `prisma migrate deploy` (every migration, in order) -> seed
#        -> `prisma migrate diff` between the migrated database and schema.prisma
#        (non-zero if a schema change was made without a migration).
# copy:  apply migrations up to BASELINE_MIGRATION, load realistic fixture rows
#        (scripts/migration-fixtures/baseline-data.sql), apply all the remaining
#        migrations, then assert they succeeded and the rows survived
#        (scripts/migration-fixtures/post-checks.sql).
#
# Safety: connects with the credentials of DATABASE_URL (default: local docker Postgres),
# creates a database named packetpulse_migcheck_<timestamp>_<pid>, and drops it on exit,
# also on failure. Refuses any host other than localhost, 127.0.0.1, ::1, postgres (same
# rule as test/require-local-db.cjs). apps/backend/.env is never read by this script, and
# the shell DATABASE_URL always wins over it inside prisma, so the database named in .env
# is never touched.
set -euo pipefail

MODE="${1:-fresh}"
case "$MODE" in fresh | copy | all) ;; *) echo "usage: $0 [fresh|copy|all]" >&2; exit 2 ;; esac

BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FIXTURES="$BACKEND_DIR/scripts/migration-fixtures"
SCHEMA="$BACKEND_DIR/prisma/schema.prisma"
MIGRATIONS="$BACKEND_DIR/prisma/migrations"
PRISMA="$BACKEND_DIR/node_modules/.bin/prisma"
[ -x "$PRISMA" ] || PRISMA="prisma"

# The last migration the fixtures were written for. "copy" applies everything up to and
# including this one, loads the fixtures, then applies every migration after it.
BASELINE_MIGRATION="${BASELINE_MIGRATION:-20260910101403_password_hash_nullable}"

BASE_URL="${DATABASE_URL:-postgresql://packetpulse:packetpulse@localhost:5433/packetpulse}"

# --- parse + guard the host ------------------------------------------------------------
parse() { node -e '
  const u = new URL(process.argv[1]);
  const host = u.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  const out = { host, db: decodeURIComponent(u.pathname.replace(/^\//, "")) };
  console.log(out[process.argv[2]]);' "$BASE_URL" "$1"; }

HOST="$(parse host 2>/dev/null || true)"
case "$HOST" in
  localhost | 127.0.0.1 | ::1 | postgres) ;;
  *)
    echo "REFUSING: DATABASE_URL host is \"${HOST:-unparseable}\", not a local database." >&2
    echo "Allowed hosts: localhost, 127.0.0.1, ::1, postgres. Never run this against Supabase." >&2
    exit 1 ;;
esac

# URL of the same server with a different database name (query string kept).
with_db() { node -e '
  const u = new URL(process.argv[1]); u.pathname = "/" + process.argv[2]; console.log(u.toString());' "$BASE_URL" "$1"; }

STAMP="$(date +%Y%m%d%H%M%S)_$$"
CURRENT=""
cleanup() {
  local rc=$?
  if [ -n "$CURRENT" ]; then
    # psql cannot take Prisma-only query params (?schema=..); strip the query.
    psql "$(psql_url "$BASE_URL")" -v ON_ERROR_STOP=1 -qc "DROP DATABASE IF EXISTS \"$CURRENT\" WITH (FORCE)" >/dev/null 2>&1 \
      && echo "dropped throwaway database $CURRENT" \
      || echo "WARNING: could not drop $CURRENT - drop it by hand" >&2
  fi
  exit $rc
}
psql_url() { node -e 'const u=new URL(process.argv[1]); u.search=""; console.log(u.toString())' "$1"; }
trap cleanup EXIT INT TERM

new_db() { # $1 = label; sets CURRENT, DB_URL
  CURRENT="packetpulse_migcheck_${1}_${STAMP}"
  psql "$(psql_url "$BASE_URL")" -v ON_ERROR_STOP=1 -qc "CREATE DATABASE \"$CURRENT\"" >/dev/null
  DB_URL="$(with_db "$CURRENT")"
  # Hard stop: the throwaway name must differ from the configured database.
  [ "$CURRENT" != "$(parse db)" ] || { echo "refusing: throwaway equals configured database" >&2; exit 1; }
  echo "created throwaway database $CURRENT on $HOST"
}
drop_db() {
  psql "$(psql_url "$BASE_URL")" -v ON_ERROR_STOP=1 -qc "DROP DATABASE IF EXISTS \"$CURRENT\" WITH (FORCE)" >/dev/null
  echo "dropped throwaway database $CURRENT"
  CURRENT=""
}
sql() { psql "$(psql_url "$DB_URL")" -v ON_ERROR_STOP=1 -q "$@"; }
prisma_env() { env DATABASE_URL="$DB_URL" "$@"; }

step() { printf '\n== %s\n' "$*"; }

# --- mode: fresh -----------------------------------------------------------------------
run_fresh() {
  new_db fresh
  step "apply every migration to an empty database (prisma migrate deploy)"
  (cd "$BACKEND_DIR" && prisma_env "$PRISMA" migrate deploy --schema "$SCHEMA")

  step "run the seed"
  (cd "$BACKEND_DIR" && prisma_env node_modules/.bin/ts-node --transpile-only prisma/seed.ts)

  step "drift check: migrated database vs prisma/schema.prisma"
  # --exit-code: 0 = identical, 2 = differences, 1 = error. Anything but 0 fails.
  if (cd "$BACKEND_DIR" && prisma_env "$PRISMA" migrate diff \
        --from-url "$DB_URL" --to-schema-datamodel "$SCHEMA" --exit-code); then
    echo "no drift: migrations and schema.prisma agree"
  else
    echo "FAIL: schema.prisma and the migrations disagree. Create a migration (prisma migrate dev --create-only) that covers the difference above." >&2
    exit 1
  fi
  drop_db
  echo "OK fresh"
}

# --- mode: copy (migrations over existing data) ----------------------------------------
run_copy() {
  new_db copy
  local tmp; tmp="$(mktemp -d)"
  # A migration directory holding only the baseline subset; prisma finds migrations next
  # to the schema file, so a temp copy of the schema points it there.
  mkdir -p "$tmp/prisma/migrations"
  cp "$SCHEMA" "$tmp/prisma/schema.prisma"
  cp "$MIGRATIONS/migration_lock.toml" "$tmp/prisma/migrations/"
  local found=0 name
  for d in "$MIGRATIONS"/*/; do
    name="$(basename "$d")"
    cp -r "$d" "$tmp/prisma/migrations/$name"
    if [ "$name" = "$BASELINE_MIGRATION" ]; then found=1; break; fi
  done
  [ "$found" = 1 ] || { echo "BASELINE_MIGRATION $BASELINE_MIGRATION not found" >&2; rm -rf "$tmp"; exit 1; }

  step "apply migrations up to $BASELINE_MIGRATION"
  (cd "$BACKEND_DIR" && prisma_env "$PRISMA" migrate deploy --schema "$tmp/prisma/schema.prisma")
  rm -rf "$tmp"

  step "load fixture rows"
  sql -f "$FIXTURES/baseline-data.sql"

  step "apply the remaining migrations over the loaded rows"
  (cd "$BACKEND_DIR" && prisma_env "$PRISMA" migrate deploy --schema "$SCHEMA")

  step "assert the rows survived and the audit trigger behaves"
  sql -f "$FIXTURES/post-checks.sql"
  drop_db
  echo "OK copy"
}

case "$MODE" in
  fresh) run_fresh ;;
  copy) run_copy ;;
  all) run_fresh; run_copy ;;
esac
echo; echo "check-migrations: PASS ($MODE)"
