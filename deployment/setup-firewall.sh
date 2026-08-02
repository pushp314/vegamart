#!/usr/bin/env bash
# ==============================================================================
# setup-firewall.sh — UFW: deny all inbound except SSH, HTTP, HTTPS. Idempotent.
# ==============================================================================
set -Eeuo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/scripts" && pwd)/lib.sh"

require_root
load_config

SSH_PORT="${SSH_PORT:-22}"

step "Firewall setup (UFW)"

if ! command -v ufw >/dev/null 2>&1; then
  apt_ensure ufw
fi

# Never apply the default-deny before the allow rules exist.
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
ufw allow "${SSH_PORT}/tcp" comment 'SSH' >/dev/null
ufw allow 80/tcp comment 'HTTP' >/dev/null
ufw allow 443/tcp comment 'HTTPS' >/dev/null
ufw limit "${SSH_PORT}/tcp" comment 'SSH (rate-limited)' >/dev/null 2>&1 || true

# Note: API (8080) and web (3000) ports are intentionally NOT opened — they are
# loopback-only and reachable exclusively through Nginx on 80/443.

ufw --force enable >/dev/null
ufw reload >/dev/null

ok "UFW is active. Allowed inbound: ${SSH_PORT}, 80, 443."
