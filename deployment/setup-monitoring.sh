#!/usr/bin/env bash
# ==============================================================================
# setup-monitoring.sh — installs lightweight health monitoring:
#   * healthcheck.sh runs every 5 minutes via cron, logs only failures.
#   * jq + curl + openssl (script dependencies) are ensured.
# Idempotent.
# ==============================================================================
set -Eeuo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/scripts" && pwd)/lib.sh"

require_root
load_config
ensure_dirs

step "Monitoring setup"

apt_ensure curl jq openssl netcat-openbsd

# Cron entry (idempotent, marker-guarded).
CRON_MONITOR="*/5 * * * * ${DEPLOY_DIR}/healthcheck.sh --quiet >> ${LOGS_DIR}/cron-health.log 2>&1 || true"
crontab -l 2>/dev/null | grep -qF "$CRON_MONITOR" || {
  ( crontab -l 2>/dev/null; printf '%s\n' "$CRON_MONITOR" ) | crontab -
  ok "Health monitor cron installed (every 5 min)"
}

step "Monitoring ready — see /opt/vegamart/logs/healthcheck.log"
