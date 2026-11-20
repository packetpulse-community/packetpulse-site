#!/usr/bin/env bash
# TASK-004: logical backup of the PacketPulse Postgres database.
#
#   DATABASE_URL=postgresql://... bash scripts/backup/backup.sh
#
# Produces  $BACKUP_DIR/packetpulse-<UTC timestamp>.dump[.gpg]  (+ .sha256 and .manifest)
# and prunes old backups. Read-only against the database. The connection string is a
# secret: this script never prints it (not even on error) and never writes it to disk.
#
# Environment:
#   DATABASE_URL            required. For Supabase use the DIRECT or SESSION-pooler string,
#                           not the transaction pooler (port 6543): pg_dump needs a real session.
#   BACKUP_DIR              output directory (default: ./backups, created 0700)
#   BACKUP_PASSPHRASE       optional. When set the dump is encrypted with gpg (AES256,
#                           symmetric) and the plain file is removed.
#   BACKUP_SCHEMAS          comma list of schemas to dump (default: public). Supabase keeps
#                           its own auth/storage schemas out of ours; set "" to dump all.
#   BACKUP_RETENTION_DAYS   delete backups older than this (default: 14)
#   BACKUP_KEEP_MIN         never prune below this many newest backups (default: 3), so a
#                           long outage of the job cannot empty the directory
#   BACKUP_PREFIX           file name prefix (default: packetpulse)
#
# pg_dump -Fc is already compressed (-Z 9), so there is no extra gzip layer.
# --no-owner --no-privileges: the dump restores into any role (Supabase roles do not exist
# locally). The pg_dump major version must be >= the server's major version.
set -euo pipefail
umask 077

die() { echo "backup: $*" >&2; exit 1; }

[ -n "${DATABASE_URL:-}" ] || die "DATABASE_URL is not set (nothing was done)"
command -v pg_dump >/dev/null || die "pg_dump not found (install postgresql-client)"
command -v psql >/dev/null || die "psql not found (install postgresql-client)"

BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
KEEP_MIN="${BACKUP_KEEP_MIN:-3}"
PREFIX="${BACKUP_PREFIX:-packetpulse}"
SCHEMAS="${BACKUP_SCHEMAS-public}"
case "$RETENTION_DAYS$KEEP_MIN" in *[!0-9]*) die "BACKUP_RETENTION_DAYS and BACKUP_KEEP_MIN must be whole numbers" ;; esac
[ -z "${BACKUP_PASSPHRASE:-}" ] || command -v gpg >/dev/null || die "BACKUP_PASSPHRASE is set but gpg is not installed"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$BACKUP_DIR/$PREFIX-$STAMP.dump"
PARTIAL="$OUT.partial"
trap 'rm -f "$PARTIAL" "$OUT.manifest.partial"' EXIT

# Connectivity check with a redacted failure message (libpq may echo host details).
psql "$DATABASE_URL" -Atqc 'select 1' >/dev/null 2>&1 || die "cannot connect with DATABASE_URL (check the secret, network access and that it is not the transaction pooler)"

args=(-Fc -Z 9 --no-owner --no-privileges --dbname="$DATABASE_URL" --file="$PARTIAL")
if [ -n "$SCHEMAS" ]; then
  IFS=',' read -r -a schema_list <<<"$SCHEMAS"
  for s in "${schema_list[@]}"; do args+=(--schema="$s"); done
fi

echo "backup: dumping (schemas: ${SCHEMAS:-all}) ..."
pg_dump "${args[@]}" 2>"$BACKUP_DIR/.pg_dump.err" || {
  # Show the tool's error, but strip anything that looks like a connection string.
  sed -E 's#(postgres(ql)?://)[^[:space:]]+#\1***#g' "$BACKUP_DIR/.pg_dump.err" >&2
  rm -f "$BACKUP_DIR/.pg_dump.err"
  die "pg_dump failed"
}
rm -f "$BACKUP_DIR/.pg_dump.err"
mv "$PARTIAL" "$OUT"

# Manifest: informational row counts per table at (about) dump time, for the restore drill.
# Counts are not in the dump's snapshot, so on a busy database they can differ slightly.
MANIFEST="$OUT.manifest"
{
  echo "# $(basename "$OUT")  created $STAMP  pg_dump $(pg_dump --version | awk '{print $3}')"
  psql "$DATABASE_URL" -Atq -F ' ' -c "
    select format('%I', c.relname) || ' ' ||
           (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from public.%I', c.relname), false, true, '')))[1]::text
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' order by 1" 2>/dev/null
} >"$MANIFEST.partial" || true
mv "$MANIFEST.partial" "$MANIFEST"

FINAL="$OUT"
if [ -n "${BACKUP_PASSPHRASE:-}" ]; then
  # Passphrase goes over fd 3, never argv or the environment of gpg.
  gpg --batch --yes --quiet --pinentry-mode loopback --symmetric --cipher-algo AES256 \
      --passphrase-fd 3 --output "$OUT.gpg" "$OUT" 3<<<"$BACKUP_PASSPHRASE"
  rm -f "$OUT"
  FINAL="$OUT.gpg"
fi

( cd "$BACKUP_DIR" && sha256sum "$(basename "$FINAL")" >"$(basename "$FINAL").sha256" )

# Prune: newest KEEP_MIN are always kept; older ones go once past the retention age.
mapfile -t all < <(ls -1 "$BACKUP_DIR"/"$PREFIX"-*.dump "$BACKUP_DIR"/"$PREFIX"-*.dump.gpg 2>/dev/null | sort -r)
pruned=0
for i in "${!all[@]}"; do
  [ "$i" -lt "$KEEP_MIN" ] && continue
  f="${all[$i]}"
  if [ -n "$(find "$f" -mtime +"$RETENTION_DAYS" -print 2>/dev/null)" ]; then
    rm -f "$f" "$f.sha256" "${f%.gpg}.manifest"
    pruned=$((pruned + 1))
  fi
done

size="$(du -h "$FINAL" | cut -f1)"
echo "backup: wrote $FINAL ($size, $( [ -n "${BACKUP_PASSPHRASE:-}" ] && echo encrypted || echo UNENCRYPTED ))"
echo "backup: pruned $pruned old backup(s) (retention ${RETENTION_DAYS}d, always keeping the newest $KEEP_MIN)"
echo "$FINAL" >"$BACKUP_DIR/.latest"
