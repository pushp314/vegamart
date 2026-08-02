#!/usr/bin/env bash
# ==============================================================================
# rollback.sh — roll back to the previous release (or a named release).
#   ./rollback.sh                 interactive: pick a release
#   ./rollback.sh -y              automatically use the previous release
#   ./rollback.sh <release_id>    roll back to a specific release
#   ./rollback.sh <release_id> --db backups/file.dump.gz   also restore a DB backup
# ==============================================================================
set -Eeuo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/scripts" && pwd)/lib.sh"
# shellcheck disable=SC1091
source "$LIB_DIR/release.sh"

require_root
load_config
ensure_dirs

TARGET=""
AUTO=0
DB_RESTORE=""
while (( $# > 0 )); do
  case "$1" in
    -y|--yes) AUTO=1 ;;
    --db) shift; DB_RESTORE="${1:-}" ;;
    *) TARGET="$1" ;;
  esac
  shift
done

[[ -L "$CURRENT_LINK" ]] || die "No active release to roll back from."

if [[ -n "$TARGET" ]]; then
  [[ -d "${RELEASES_DIR}/${TARGET}" ]] || die "Release '${TARGET}' does not exist."
  ROLLBACK_DIR="${RELEASES_DIR}/${TARGET}"
elif (( AUTO )); then
  if [[ -L "${RELEASES_DIR}/previous" ]]; then
    ROLLBACK_DIR="$(readlink -f "${RELEASES_DIR}/previous")"
  else
    die "No 'previous' release recorded — cannot auto-rollback."
  fi
else
  list_releases
  echo ""
  read -r -p "Enter the release to roll back to (or -y for previous): " choice
  [[ -n "$choice" ]] || die "No release selected."
  if [[ "$choice" == "-y" ]]; then
    ROLLBACK_DIR="$(readlink -f "${RELEASES_DIR}/previous")" || die "No previous release recorded."
  else
    [[ -d "${RELEASES_DIR}/${choice}" ]] || die "Release '${choice}' does not exist."
    ROLLBACK_DIR="${RELEASES_DIR}/${choice}"
  fi
fi

echo "Rolling back to: $(basename "$ROLLBACK_DIR")"
echo "  current was → $(readlink "$CURRENT_LINK")"
read -r -p "Continue? [y/N] " confirm
[[ "${confirm,,}" == "y" ]] || die "Aborted."

step "Rollback to $(basename "$ROLLBACK_DIR")"

if [[ -n "$DB_RESTORE" ]]; then
  sub "Restoring database backup"
  "${DEPLOY_DIR}/restore.sh" "$DB_RESTORE"
fi

ln -sfn "$ROLLBACK_DIR" "$CURRENT_LINK"
ok "Activated $(basename "$ROLLBACK_DIR")"

pm2 startOrReload "${CONFIGS_DIR}/ecosystem.config.js" >/dev/null 2>&1 || true
pm2 save >/dev/null 2>&1 || true
wait_ready

step "Post-rollback health"
"${DEPLOY_DIR}/healthcheck.sh" || die "Health check failed after rollback."
ok "Rollback complete"
