#!/usr/bin/env bash
# ==============================================================================
# update.sh — deploy the latest code from the configured branch.
#   * pre-update database backup
#   * new release (clone → deps → schema → build → activate)
#   * health check
#   * automatic rollback if the new release fails health checks
# Optional: --seed  re-runs the database seed.
# ==============================================================================
set -Eeuo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/scripts" && pwd)/lib.sh"
# shellcheck disable=SC1091
source "$LIB_DIR/release.sh"

require_root
load_config
ensure_dirs

[[ -e "$CURRENT_LINK" ]] || die "No active release found. Run ./deploy.sh first."

SEED=0
[[ "${1:-}" == "--seed" ]] && SEED=1

ACTIVATED=0
RELEASE_DIR=""
on_error() {
  error "update.sh failed."
  if [[ -n "$RELEASE_DIR" && -d "$RELEASE_DIR" ]]; then
    warn "Removing incomplete release: $(basename "$RELEASE_DIR")"
    rm -rf "$RELEASE_DIR" 2>/dev/null || true
  fi
  if (( ACTIVATED )) && [[ -L "${RELEASES_DIR}/previous" ]]; then
    warn "Rolling back to previous release automatically."
    "${DEPLOY_DIR}/rollback.sh" -y || true
  fi
  exit 1
}
trap on_error ERR

step "Updating Vegamart"

sub "Pre-update database backup"
"${DEPLOY_DIR}/backup.sh" --db --quiet

RELEASE_DIR="${RELEASES_DIR}/$(new_release_id)"
step "Release: $(basename "$RELEASE_DIR")"

clone_repo "$RELEASE_DIR"
write_env_files "$RELEASE_DIR"

build_backend "$RELEASE_DIR"
(( SEED )) && seed_db "$RELEASE_DIR"
build_frontend "$RELEASE_DIR"

activate_release "$RELEASE_DIR"
ACTIVATED=1
wait_ready

step "Health check"
if "${DEPLOY_DIR}/healthcheck.sh"; then
  ok "Update successful — release $(basename "$RELEASE_DIR") is live."
else
  error "Health check failed after update."
  "${DEPLOY_DIR}/rollback.sh" -y || true
  exit 1
fi

trap - ERR
