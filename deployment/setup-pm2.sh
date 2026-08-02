#!/usr/bin/env bash
# ==============================================================================
# setup-pm2.sh — renders the PM2 ecosystem and starts/reloads the app processes.
# Configures PM2 boot-time startup and pm2-logrotate. Idempotent.
# ==============================================================================
set -Eeuo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/scripts" && pwd)/lib.sh"

require_root
load_config
ensure_dirs

step "PM2 setup"

if ! command -v pm2 >/dev/null 2>&1; then
  "${DEPLOY_DIR}/setup-node.sh"
fi
command -v pm2 >/dev/null 2>&1 || die "PM2 is not available."

sub "Rendering ecosystem file"
render_template "${DEPLOY_DIR}/pm2/ecosystem.config.js" "${CONFIGS_DIR}/ecosystem.config.js"
ok "Ecosystem → ${CONFIGS_DIR}/ecosystem.config.js"

if [[ -f "${CURRENT_LINK}/backend/dist/server.js" ]]; then
  sub "Starting/reloading PM2 apps"
  pm2 startOrReload "${CONFIGS_DIR}/ecosystem.config.js"
  ok "PM2 apps started"
else
  warn "No release deployed yet — PM2 apps will start on the first deploy."
fi

sub "Persisting process list + boot startup"
pm2 save >/dev/null 2>&1 || true
pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true
systemctl enable pm2-root >/dev/null 2>&1 || true
info "PM2 boot startup enabled (pm2-root)"

sub "pm2-logrotate (max 20M, 30 files, compressed)"
pm2 install pm2-logrotate >/dev/null 2>&1 || true
pm2 conf pm2-logrotate:max_size "20M" >/dev/null 2>&1 || true
pm2 conf pm2-logrotate:retain 30 >/dev/null 2>&1 || true
pm2 conf pm2-logrotate:compress true >/dev/null 2>&1 || true
pm2 conf pm2-logrotate:rotateInterval "0 0 * * *" >/dev/null 2>&1 || true

step "PM2 ready"
pm2 list
