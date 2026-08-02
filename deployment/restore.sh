#!/usr/bin/env bash
# ==============================================================================
# restore.sh — restore a PostgreSQL backup (destructive; requires confirmation).
#   ./restore.sh backups/vegamart-<ts>.dump.gz
#   ./restore.sh <basename>            looks inside backups/
#   ./restore.sh <file> -y             skip the confirmation prompt
# ==============================================================================
set -Eeuo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/scripts" && pwd)/lib.sh"

require_root
load_config
ensure_dirs

[[ $# -ge 1 ]] || die "Usage: restore.sh <backup-file> [-y]"

BACKUP="$1"; CONFIRM=1
if [[ "${2:-}" == "-y" ]]; then CONFIRM=0; fi

if [[ ! -f "$BACKUP" ]]; then
  [[ -f "${BACKUPS_DIR}/${BACKUP}" ]] && BACKUP="${BACKUPS_DIR}/${BACKUP}" \
    || die "Backup not found: $BACKUP (looked in ${BACKUPS_DIR})"
fi
[[ "$BACKUP" == *.gz ]] || die "Only .gz-compressed dumps are supported."

# Same DATABASE_URL parsing as backup.sh.
DB_URL="${DATABASE_URL:-}"
if [[ -z "$DB_URL" && -f "$ENV_FILE" ]]; then
  DB_URL="$(grep -E '^DATABASE_URL=' "$ENV_FILE" | head -n1 | cut -d'=' -f2- | tr -d '\r')"
fi
[[ -n "$DB_URL" ]] || die "DATABASE_URL not found in ${ENV_FILE}."

read -r DB_HOST DB_PORT DB_USER DB_PASS DB_NAME < <(python3 - "$DB_URL" <<'PYEOF'
import sys, urllib.parse
u = urllib.parse.urlparse(sys.argv[1])
print(u.hostname or "127.0.0.1", u.port or 5432, urllib.parse.unquote(u.username or ""), urllib.parse.unquote(u.password or ""), u.path.lstrip("/").split("/")[0])
PYEOF
)
export PGPASSWORD="$DB_PASS"

echo "Restoring database '${DB_NAME}' from ${BACKUP}"
echo "WARNING: this DESTROYS the current data in '${DB_NAME}'."
if (( CONFIRM )); then
  read -r -p "Continue? [y/N] " answer
  [[ "${answer,,}" == "y" ]] || die "Aborted."
fi

step "Restoring database"
pg_isready -h "$DB_HOST" -p "$DB_PORT" >/dev/null 2>&1 || die "Database not reachable at ${DB_HOST}:${DB_PORT}."

# Terminate active connections so the DROP can succeed (PM2 apps reconnect after).
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -v ON_ERROR_STOP=1 \
  -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${DB_NAME}' AND pid<>pg_backend_pid();" >/dev/null 2>&1 || true

# Drop + recreate for a clean restore, then restore the custom-format dump.
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -v ON_ERROR_STOP=1 \
  -c "DROP DATABASE IF EXISTS ${DB_NAME};" \
  -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};" >/dev/null

gzip -dc "$BACKUP" | pg_restore -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
  --no-owner --exit-on-error
ok "Database restored from $(basename "$BACKUP")"

unset PGPASSWORD
