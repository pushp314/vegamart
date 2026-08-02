#!/usr/bin/env bash
# ==============================================================================
# setup-redis.sh — installs Redis for caching + rate limiting, binds it to
# localhost only, sets a generated password, and enables boot-time start.
# Idempotent. Safe to re-run.
# ==============================================================================
set -Eeuo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/scripts" && pwd)/lib.sh"

require_root
load_config

step "Redis setup"

apt_ensure redis-server redis-tools

# Generated password (never regenerates) — stored next to the DB password.
REDIS_PASSWORD_FILE="${REDIS_PASSWORD_FILE:-${DEPLOY_DIR}/generated-redis-password.txt}"
if [[ -f "$REDIS_PASSWORD_FILE" ]]; then
  REDIS_PASSWORD="$(tr -d '\r\n' < "$REDIS_PASSWORD_FILE")"
else
  REDIS_PASSWORD="$(gen_password)"
  printf '%s\n' "$REDIS_PASSWORD" > "$REDIS_PASSWORD_FILE"
  chmod 600 "$REDIS_PASSWORD_FILE"
  warn "Generated Redis password -> $REDIS_PASSWORD_FILE"
fi
export REDIS_PASSWORD

# Managed override file, included from the main redis.conf (later = wins).
CONF_INCLUDE="/etc/redis/vegamart.conf"
if [[ ! -f "$CONF_INCLUDE" ]]; then
  cat > "$CONF_INCLUDE" <<EOF
# Managed by Vegamart deployment toolkit — overrides defaults via include.
bind 127.0.0.1 -::1
protected-mode yes
requirepass ${REDIS_PASSWORD}
maxmemory 256mb
maxmemory-policy allkeys-lru
EOF
  chmod 640 "$CONF_INCLUDE"
  info "Wrote ${CONF_INCLUDE}"
fi

if ! grep -q "^include ${CONF_INCLUDE}" /etc/redis/redis.conf 2>/dev/null; then
  printf '\ninclude %s\n' "$CONF_INCLUDE" >> /etc/redis/redis.conf
fi

systemctl enable redis-server >/dev/null 2>&1 || true
systemctl restart redis-server

sleep 1
if redis-cli -a "$REDIS_PASSWORD" --no-auth-warning ping 2>/dev/null | grep -q PONG; then
  ok "Redis running on 127.0.0.1:6379 (password protected)"
else
  die "Redis did not answer PING — check 'systemctl status redis-server'."
fi

echo "  REDIS_URL=redis://:${REDIS_PASSWORD}@127.0.0.1:6379"
step "Redis ready"
