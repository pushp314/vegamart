#!/usr/bin/env bash
# ==============================================================================
# uninstall.sh — safely remove the Vegamart application.
#   * stops + deletes PM2 processes, disables boot startup
#   * removes the Nginx site config
#   * removes the cron block
#   * removes /opt/vegamart (release, backups, logs, env)
# By default the OS packages (nginx, postgresql, node, ...) are kept. Use
# --purge to also remove them.
# ==============================================================================
set -Eeuo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/scripts" && pwd)/lib.sh"

require_root
load_config

PURGE=0
[[ "${1:-}" == "--purge" ]] && PURGE=1

echo "This will REMOVE the Vegamart application from this server."
echo "  Target: ${APP_BASE_DIR}"
echo "  Database: ${DB_NAME} on localhost (data will be deleted)"
read -r -p "Type YES to continue: " confirm
[[ "$confirm" == "YES" ]] || die "Aborted."

step "Uninstalling Vegamart"

if command -v pm2 >/dev/null 2>&1; then
  sub "Stopping + deleting PM2 processes"
  pm2 delete vegamart-api >/dev/null 2>&1 || true
  pm2 delete vegamart-web >/dev/null 2>&1 || true
  pm2 save >/dev/null 2>&1 || true
  pm2 startup systemd -u root --hp /root delete >/dev/null 2>&1 || true
  pm2 unstartup systemd -u root --hp /root >/dev/null 2>&1 || true
  systemctl disable pm2-root >/dev/null 2>&1 || true
fi

sub "Removing Nginx site"
rm -f "/etc/nginx/sites-enabled/vegamart" "/etc/nginx/sites-available/vegamart"
nginx -t >/dev/null 2>&1 && systemctl reload nginx || true

sub "Removing cron block"
MARK_BEGIN="# === VEGAMART DEPLOYMENT CRON (auto-managed) ==="
MARK_END="# === END VEGAMART DEPLOYMENT CRON ==="
crontab -l 2>/dev/null | awk -v b="$MARK_BEGIN" -v e="$MARK_END" 'BEGIN{skip=0} $0==b{skip=1} !skip{print} $0==e{skip=0}' | crontab - || true

sub "Removing application directory"
rm -rf "$APP_BASE_DIR"
ok "Removed ${APP_BASE_DIR}"

if (( PURGE )); then
  sub "Purging installed packages"
  DEBIAN_FRONTEND=noninteractive apt-get purge -y nginx postgresql postgresql-contrib \
    pgbouncer fail2ban certbot python3-certbot-nginx ufw nodejs >/dev/null 2>&1 || true
  DEBIAN_FRONTEND=noninteractive apt-get autoremove -y >/dev/null 2>&1 || true
  ok "Packages purged"
fi

ok "Uninstall complete."
