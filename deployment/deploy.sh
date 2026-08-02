#!/usr/bin/env bash
# ==============================================================================
# deploy.sh — full deployment of the current branch into a new release.
#   * prep environment file (creates from example + fills secrets if needed)
#   * clone repo → new release
#   * install deps, apply schema, seed, build backend + frontend
#   * activate release, reload PM2 + Nginx
#   * configure SSL, firewall, fail2ban, logrotate, monitoring, cron
#   * verify + success report
# Safe to run repeatedly (idempotent). On build failure the release is removed
# and the currently active release is left untouched.
# ==============================================================================
set -Eeuo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/scripts" && pwd)/lib.sh"
# shellcheck disable=SC1091
source "$LIB_DIR/release.sh"

require_root
load_config
ensure_dirs
require_env_file

FIRST_RELEASE=0
if [[ ! -e "$CURRENT_LINK" ]]; then FIRST_RELEASE=1; fi

SEED=0
[[ "${1:-}" == "--seed" ]] && SEED=1
(( FIRST_RELEASE )) && SEED=1

step "Deploying Vegamart → ${APP_BASE_DIR}"

# ------------------------------------------------------------------------------
# 0. Preflight — provision missing pieces so a bare box still succeeds.
# ------------------------------------------------------------------------------
command -v git >/dev/null 2>&1 || apt_ensure git ca-certificates openssl
command -v node >/dev/null 2>&1 || "${DEPLOY_DIR}/setup-node.sh"
command -v psql >/dev/null 2>&1 || "${DEPLOY_DIR}/setup-postgres.sh"
command -v pm2 >/dev/null 2>&1 || "${DEPLOY_DIR}/setup-node.sh"

fill_secrets
validate_env

# ------------------------------------------------------------------------------
# 1. New release
# ------------------------------------------------------------------------------
RELEASE_DIR="${RELEASES_DIR}/$(new_release_id)"
step "Release: $(basename "$RELEASE_DIR")"

cleanup_on_fail() {
  rm -rf "$RELEASE_DIR" 2>/dev/null || true
}
trap cleanup_on_fail ERR

clone_repo "$RELEASE_DIR"
write_env_files "$RELEASE_DIR"

build_backend "$RELEASE_DIR"
(( SEED )) && seed_db "$RELEASE_DIR"
build_frontend "$RELEASE_DIR"

trap - ERR

# ------------------------------------------------------------------------------
# 2. Activate
# ------------------------------------------------------------------------------
activate_release "$RELEASE_DIR"
wait_ready

# ------------------------------------------------------------------------------
# 3. Reverse proxy + SSL
# ------------------------------------------------------------------------------
if [[ -n "$DOMAIN" ]]; then
  "${DEPLOY_DIR}/setup-nginx.sh"
  "${DEPLOY_DIR}/setup-ssl.sh" || warn "SSL pending — point DNS at this server and re-run ./setup-ssl.sh"
else
  warn "DOMAIN not set in configs/deploy.env — skipping Nginx site + SSL. API/Web still reachable on ports ${API_PORT}/${WEB_PORT}."
fi

# ------------------------------------------------------------------------------
# 4. Security + operations (idempotent)
# ------------------------------------------------------------------------------
if ! ufw status 2>/dev/null | grep -q "Status: active"; then
  "${DEPLOY_DIR}/setup-firewall.sh"
fi
"${DEPLOY_DIR}/setup-fail2ban.sh"
"${DEPLOY_DIR}/setup-logrotate.sh"
"${DEPLOY_DIR}/setup-monitoring.sh"
"${DEPLOY_DIR}/setup-cron.sh"

# ------------------------------------------------------------------------------
# 5. Verify + report
# ------------------------------------------------------------------------------
step "Deployment verification"
"${DEPLOY_DIR}/verify.sh" || warn "verify.sh reported warnings — inspect /opt/vegamart/logs/verify.log"

print_success_banner
echo "  Release:   $(basename "$RELEASE_DIR")"
echo "  API:       http://127.0.0.1:${API_PORT}/api/v1/health"
[[ -n "$DOMAIN" ]] && echo "  Site:      https://${DOMAIN}"
echo "  PM2:       pm2 list"
echo "  Logs:      ${LOGS_DIR}"
echo "  Next:      ./update.sh to deploy new versions, ./rollback.sh to revert."
