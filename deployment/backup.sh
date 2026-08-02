#!/usr/bin/env bash
# ==============================================================================
# backup.sh — PostgreSQL backup (custom format + gzip, timestamped).
#   ./backup.sh            manual backup (database)
#   ./backup.sh --db       database backup
#   ./backup.sh --all      database + environment/credentials bundle
#   ./backup.sh --quiet    silent (cron); errors still logged
# Retention (30 days) is enforced by cleanup.sh. Idempotent.
# ==============================================================================
set -Eeuo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/scripts" && pwd)/lib.sh"

require_root
load_config
ensure_dirs

MODE="db"; QUIET=0
for a in "$@"; do
  case "$a" in
    --db) MODE="db" ;;
    --all) MODE="all" ;;
    --quiet) QUIET=1 ;;
  esac
done
say() { (( QUIET )) || info "$*"; }

# Parse DATABASE_URL from the production env file (works with PgBouncer too).
DB_URL="${DATABASE_URL:-}"
if [[ -z "$DB_URL" && -f "$ENV_FILE" ]]; then
  DB_URL="$(grep -E '^DATABASE_URL=' "$ENV_FILE" | head -n1 | cut -d'=' -f2- | tr -d '\r')"
fi
[[ -n "$DB_URL" ]] || die "DATABASE_URL not found in ${ENV_FILE}."

# Extract connection parts via python3 (handles URL-encoding and query strings).
read -r DB_HOST DB_PORT DB_USER DB_PASS DB_NAME < <(python3 - "$DB_URL" <<'PYEOF'
import sys, urllib.parse
u = urllib.parse.urlparse(sys.argv[1])
print(u.hostname or "127.0.0.1", u.port or 5432, urllib.parse.unquote(u.username or ""), urllib.parse.unquote(u.password or ""), u.path.lstrip("/").split("/")[0])
PYEOF
)
export PGPASSWORD="$DB_PASS"

TS="$(date +%Y%m%d_%H%M%S)"
OUT_FILE="${BACKUPS_DIR}/vegamart-${TS}.dump.gz"

step "Database backup"
if command -v pg_dump >/dev/null 2>&1 && pg_isready -h "$DB_HOST" -p "$DB_PORT" >/dev/null 2>&1; then
  pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" --format=custom --no-owner 2>"${LOGS_DIR}/pgdump-err.log" | gzip > "$OUT_FILE"
  [[ -s "$OUT_FILE" ]] || die "Backup produced an empty file — aborting."
  say "Wrote ${OUT_FILE} ($(du -h "$OUT_FILE" | cut -f1))"
else
  die "pg_dump/pg_isready unavailable or database not reachable at ${DB_HOST}:${DB_PORT}."
fi

if [[ "$MODE" == "all" ]]; then
  BUNDLE="${BACKUPS_DIR}/vegamart-env-${TS}.tar.gz"
  tar -czf "$BUNDLE" -C / \
    "${ENV_FILE#/}" \
    "${DB_PASSWORD_FILE#/}" \
    "${CONFIGS_DIR#/}" 2>/dev/null || tar -czf "$BUNDLE" -C / "${ENV_FILE#/}" "${DB_PASSWORD_FILE#/}"
  say "Wrote ${BUNDLE} (env + credentials — store offline, never in git)"
fi

unset PGPASSWORD
ok "Backup complete"
