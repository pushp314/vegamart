#!/usr/bin/env bash
# ==============================================================================
# cleanup.sh — retention policy enforcement.
#   * keep N latest releases (current + previous are always kept)
#   * delete DB backups older than RETENTION_BACKUP_DAYS
#   * delete rotated logs older than RETENTION_LOG_DAYS
#   * clear stale temp files
# Runs daily via cron. Idempotent.
# ==============================================================================
set -Eeuo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/scripts" && pwd)/lib.sh"

require_root
load_config
ensure_dirs

QUIET=0
[[ "${1:-}" == "--quiet" ]] && QUIET=1
say() { (( QUIET )) || info "$*"; }

step "Cleanup (retention: backups=${RETENTION_BACKUP_DAYS}d, logs=${RETENTION_LOG_DAYS}d, releases=${RELEASE_KEEP})"

# --- Releases: keep newest RELEASE_KEEP, always keep current + previous ------
mapfile -t protected < <(readlink -f "$CURRENT_LINK" 2>/dev/null; readlink -f "${RELEASES_DIR}/previous" 2>/dev/null)
mapfile -t old_releases < <(find "$RELEASES_DIR" -mindepth 1 -maxdepth 1 -type d \
  ! -name current ! -name previous -printf '%f\n' 2>/dev/null | sort -r | tail -n +$((RELEASE_KEEP + 1)))
for r in "${old_releases[@]:-}"; do
  [[ -d "${RELEASES_DIR}/$r" ]] || continue
  local_dir="$(readlink -f "${RELEASES_DIR}/$r")"
  for p in "${protected[@]:-}"; do
    [[ "$local_dir" == "$p" ]] && continue 2
  done
  say "Removing old release: ${r}"
  rm -rf "${RELEASES_DIR}/$r"
done

# --- Backups -----------------------------------------------------------------
find "$BACKUPS_DIR" -type f -name '*.dump.gz' -mtime "+${RETENTION_BACKUP_DAYS}" -delete
say "Backups older than ${RETENTION_BACKUP_DAYS}d pruned"

# --- Logs --------------------------------------------------------------------
find "$LOGS_DIR" -type f -mtime "+${RETENTION_LOG_DAYS}" -delete
say "Logs older than ${RETENTION_LOG_DAYS}d pruned"

# --- Temp files ---------------------------------------------------------------
find "$TMP_DIR" -type f -mmin "+$((24 * 60))" -delete 2>/dev/null || true
say "Stale temp files cleared"

ok "Cleanup complete"
