#!/usr/bin/env bash
# ==============================================================================
# setup-logrotate.sh — log rotation + compression, 30-day retention, for Nginx,
# PM2/app logs and toolkit logs. Idempotent.
# ==============================================================================
set -Eeuo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/scripts" && pwd)/lib.sh"

require_root
load_config
ensure_dirs

step "Log rotation setup"

apt_ensure logrotate

LOGROTATE_CONF="/etc/logrotate.d/vegamart"
cat > "$LOGROTATE_CONF" <<EOF
# Vegamart — application, toolkit and Nginx logs (30-day retention, compressed)
${LOGS_DIR}/*.log {
    daily
    rotate ${RETENTION_LOG_DAYS}
    compress
    delaycompress
    missingok
    notifempty
    copytruncate
    dateext
}

${APP_BASE_DIR}/releases/current/backend/logs/*.log {
    daily
    rotate ${RETENTION_LOG_DAYS}
    compress
    delaycompress
    missingok
    notifempty
    copytruncate
    dateext
}

/var/log/nginx/vegamart-*.log {
    daily
    rotate ${RETENTION_LOG_DAYS}
    compress
    delaycompress
    missingok
    notifempty
    create 0640 www-data adm
    sharedscripts
    postrotate
        [ -f /run/nginx.pid ] && kill -USR1 \$(cat /run/nginx.pid)
    endscript
}
EOF

logrotate -f "$LOGROTATE_CONF" >/dev/null 2>&1 || true
ok "Logrotate configured: ${LOGROTATE_CONF} (${RETENTION_LOG_DAYS} days)"
