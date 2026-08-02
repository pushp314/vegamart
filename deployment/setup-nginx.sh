#!/usr/bin/env bash
# ==============================================================================
# setup-nginx.sh — installs Nginx and (re)generates the site configuration.
# ==============================================================================
set -Eeuo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/scripts" && pwd)/lib.sh"

require_root
load_config
require_var DOMAIN "Add 'DOMAIN=your-domain.com' to configs/deploy.env."
require_var API_PORT
require_var WEB_PORT

step "Nginx setup"

if ! command -v nginx >/dev/null 2>&1; then
  sub "Installing Nginx"
  DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends nginx >/dev/null
  systemctl enable nginx >/dev/null 2>&1
  ok "Nginx installed"
else
  info "Nginx already installed: $(nginx -v 2>&1)"
fi

sub "Rendering Nginx configuration"
"${DEPLOY_DIR}/scripts/nginx-config.sh"
nginx -t
systemctl reload nginx
ok "Nginx configuration applied and reloaded"
