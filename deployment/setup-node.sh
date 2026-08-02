#!/usr/bin/env bash
# ==============================================================================
# setup-node.sh — installs Node.js LTS, npm, and PM2. Idempotent.
# ==============================================================================
set -Eeuo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/scripts" && pwd)/lib.sh"

require_root
load_config

step "Node.js setup (LTS ${NODE_MAJOR:-24})"

if command -v node >/dev/null 2>&1; then
  node_version="$(node -v | tr -d 'v')"
  major="${node_version%%.*}"
  if [[ "$major" == "${NODE_MAJOR:-24}" ]]; then
    info "Node.js ${node_version} already installed and on the target major. Skipping."
  else
    warn "Node.js ${node_version} found, but config wants ${NODE_MAJOR:-24} (LTS). Leaving existing install."
  fi
else
  sub "Installing NodeSource apt repository (Node ${NODE_MAJOR:-24} LTS)"
  apt_ensure ca-certificates curl gnupg
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR:-24}.x" | bash - >/dev/null
  apt_ensure nodejs
  ok "Node.js installed"
fi

if ! command -v npm >/dev/null 2>&1; then
  die "npm not found after Node install — check the NodeSource setup above."
fi
info "npm: $(npm -v)"

sub "Installing/upgrading PM2"
npm install -g pm2 >/dev/null 2>&1 || npm install -g pm2
ok "PM2: $(pm2 -v)"

sub "Ensuring build toolchain for native modules"
apt_ensure build-essential gcc g++ make python3 python3-pip

step "Node.js setup complete"
node -v
npm -v
pm2 -v
