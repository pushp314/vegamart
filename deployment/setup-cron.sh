#!/usr/bin/env bash
# ==============================================================================
# setup-cron.sh — installs the full cron schedule for a production box.
#   - daily 03:00  database backup
#   - daily 04:00  retention cleanup (releases, backups, temp files)
#   - daily 02:00  temp-file cleanup
#   - every 5 min  health monitor (also installed by setup-monitoring.sh)
#   - 2x weekly    certbot renewal fallback (primary is certbot.timer)
# Uses a marker-guarded block so it is safe to run repeatedly.
# ==============================================================================
set -Eeuo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/scripts" && pwd)/lib.sh"

require_root
load_config
ensure_dirs

step "Cron jobs setup"

MARK_BEGIN="# === VEGAMART DEPLOYMENT CRON (auto-managed) ==="
MARK_END="# === END VEGAMART DEPLOYMENT CRON ==="
DEPLOY_BIN="${DEPLOY_DIR}"

CRON_LINES=(
  "${MARK_BEGIN}"
  "0 3 * * * ${DEPLOY_BIN}/backup.sh --db --quiet >> ${LOGS_DIR}/cron-backup.log 2>&1"
  "0 4 * * * ${DEPLOY_BIN}/cleanup.sh --quiet >> ${LOGS_DIR}/cron-cleanup.log 2>&1"
  "0 2 * * * find ${TMP_DIR} -type f -mmin +\$((24*60)) -delete >> ${LOGS_DIR}/cron-tmp.log 2>&1"
  "0 3 * * 1,4 certbot renew --quiet --deploy-hook \"systemctl reload nginx\" >> ${LOGS_DIR}/cron-cert.log 2>&1"
  "${MARK_END}"
)

# Strip any previous managed block, then append the fresh one.
crontab -l 2>/dev/null \
  | awk -v b="$MARK_BEGIN" -v e="$MARK_END" 'BEGIN{skip=0} $0==b{skip=1} !skip{print} $0==e{skip=0}' \
  | grep -v '^$' > /tmp/vegamart-cron.new || true

printf '%s\n' "${CRON_LINES[@]}" >> /tmp/vegamart-cron.new
crontab /tmp/vegamart-cron.new
rm -f /tmp/vegamart-cron.new

info "Installed cron block:"
crontab -l 2>/dev/null | sed -n "/${MARK_BEGIN//\//\\\/}/,/${MARK_END//\//\\\/}/p"
ok "Cron jobs installed"
