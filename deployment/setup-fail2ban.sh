#!/usr/bin/env bash
# ==============================================================================
# setup-fail2ban.sh — protects SSH and Nginx with automatic banning. Idempotent.
# ==============================================================================
set -Eeuo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/scripts" && pwd)/lib.sh"

require_root
load_config

step "Fail2Ban setup"

apt_ensure fail2ban

JAIL_LOCAL="/etc/fail2ban/jail.local"
if [[ ! -f "$JAIL_LOCAL" ]]; then
  cat > "$JAIL_LOCAL" <<'EOF'
[DEFAULT]
bantime  = 1h
findtime = 10m
maxretry = 5
ignoreip = 127.0.0.1/8 ::1
backend  = systemd

[sshd]
enabled = true
port    = ssh
logpath = %(sshd_backend)s

[nginx-http-auth]
enabled  = true
logpath  = /var/log/nginx/error.log

[nginx-botsearch]
enabled  = true
logpath  = /var/log/nginx/access.log
maxretry = 5
EOF
  ok "Wrote ${JAIL_LOCAL}"
else
  info "${JAIL_LOCAL} already exists — leaving user configuration untouched."
fi

systemctl enable fail2ban >/dev/null 2>&1 || true
systemctl restart fail2ban
sleep 2

ok "Fail2Ban active. Jails: sshd, nginx-http-auth, nginx-botsearch"
fail2ban-client status 2>/dev/null | grep -E 'Jail list' || true
