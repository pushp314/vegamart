#!/usr/bin/env bash
# ==============================================================================
# install.sh — one-shot VPS provisioning for a fresh Ubuntu 24.04 Hostinger VPS.
#   * updates + upgrades Ubuntu
#   * installs the full package set
#   * Node.js LTS + npm + PM2, PostgreSQL (db/user/password), Nginx
#   * UFW, Fail2Ban, logrotate, monitoring, cron, swap, SSH hardening
#   * deploys a copy of this toolkit to /opt/vegamart/deploy
# Idempotent — safe to run repeatedly.
#
# Usage:  sudo bash install.sh
# ==============================================================================
set -Eeuo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/scripts" && pwd)/lib.sh"

require_root

STEP_SOURCE_DIR="$DEPLOY_DIR"
DEST_DIR="/opt/vegamart/deploy"

step "Vegamart VPS installer v${DEPLOY_VERSION}"

# ------------------------------------------------------------------------------
# 1. OS update + upgrade
# ------------------------------------------------------------------------------
step "Updating Ubuntu packages"
export DEBIAN_FRONTEND=noninteractive
run_with_retry 3 apt-get update >/dev/null
run_with_retry 3 apt-get -y upgrade >/dev/null
ok "System packages up to date"

# ------------------------------------------------------------------------------
# 2. Base package set
# ------------------------------------------------------------------------------
step "Installing base packages"
apt_ensure \
  git curl wget unzip zip \
  build-essential gcc g++ make \
  python3 python3-pip ca-certificates openssl \
  jq tree htop nano vim \
  ufw fail2ban cron \
  software-properties-common \
  gnupg lsb-release

# ------------------------------------------------------------------------------
# 3. Deploy a copy of this toolkit so upgrades live at a stable path
# ------------------------------------------------------------------------------
if [[ "$(readlink -f "$STEP_SOURCE_DIR")" != "$(readlink -f "$DEST_DIR")" ]]; then
  step "Copying toolkit → ${DEST_DIR}"
  mkdir -p /opt/vegamart/{releases,backups,logs,configs,tmp} "$DEST_DIR"
  cp -a "$STEP_SOURCE_DIR/." "$DEST_DIR/"
  # Strip CRLF (in case the toolkit was edited on Windows), make executable.
  find "$DEST_DIR" -type f \( -name '*.sh' -o -name '*.conf' -o -name '*.js' -o -name '*.example' -o -name '*.md' \) -exec sed -i 's/\r$//' {} \;
  find "$DEST_DIR" -type f -name '*.sh' -exec chmod +x {} \;
  ok "Toolkit deployed to ${DEST_DIR}"
  DEPLOY_DIR="$DEST_DIR"
  export DEPLOY_DIR
  CONFIG_FILE="${DEST_DIR}/configs/deploy.env"
  export CONFIG_FILE
fi

# Load config from the deployed copy (creates configs/deploy.env from example).
load_config
ensure_dirs

# ------------------------------------------------------------------------------
# 4. Time sync
# ------------------------------------------------------------------------------
step "Time synchronization"
timedatectl set-timezone UTC >/dev/null 2>&1 || true
systemctl enable systemd-timesyncd >/dev/null 2>&1 || true
systemctl start systemd-timesyncd >/dev/null 2>&1 || true
ok "Timezone UTC, timesyncd active"

# ------------------------------------------------------------------------------
# 5. Swap (optional, default on)
# ------------------------------------------------------------------------------
if [[ "$(parse_bool "${ENABLE_SWAP:-yes}")" == "1" ]] && ! swapon --show | grep -q .; then
  step "Creating 1G swap"
  fallocate -l 1G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q "/swapfile" /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  sysctl -w vm.swappiness=10 >/dev/null
  ok "Swap enabled (1G, swappiness 10)"
fi

# ------------------------------------------------------------------------------
# 6. Runtimes: Node.js + PostgreSQL
# ------------------------------------------------------------------------------
"${DEST_DIR}/setup-node.sh"
"${DEST_DIR}/setup-postgres.sh"

# ------------------------------------------------------------------------------
# 7. SSH hardening (configurable — refuses to lock you out)
# ------------------------------------------------------------------------------
step "SSH hardening"
SSHD_CONF="/etc/ssh/sshd_config"
cp "$SSHD_CONF" "${SSHD_CONF}.vegamart.bak" 2>/dev/null || true

DO_PW="$(parse_bool "${SSH_DISABLE_PASSWORD_LOGIN:-no}")"
DO_ROOT="$(parse_bool "${SSH_DISABLE_ROOT_LOGIN:-no}")"

if (( DO_PW )); then
  if ! grep -qrE '^[[:space:]]*ssh-(rsa|ed25519|ecdsa)' /root/.ssh/authorized_keys 2>/dev/null; then
    warn "No SSH keys found for root — NOT disabling password auth to avoid locking you out."
    warn "Add your public key to /root/.ssh/authorized_keys, then re-run with SSH_DISABLE_PASSWORD_LOGIN=yes."
  else
    sed -i -E 's/^#?PasswordAuthentication.*/PasswordAuthentication no/' "$SSHD_CONF"
    ok "SSH password authentication disabled"
  fi
else
  info "SSH password authentication left enabled (SSH_DISABLE_PASSWORD_LOGIN=no)"
fi

if (( DO_ROOT )); then
  sed -i -E 's/^#?PermitRootLogin.*/PermitRootLogin no/' "$SSHD_CONF"
  ok "SSH root login disabled"
else
  info "SSH root login left enabled (SSH_DISABLE_ROOT_LOGIN=no)"
fi

sshd -t >/dev/null 2>&1 && systemctl reload ssh >/dev/null 2>&1 || warn "sshd config check failed — check ${SSHD_CONF}"

# ------------------------------------------------------------------------------
# 8. Security + operations layers (idempotent)
# ------------------------------------------------------------------------------
"${DEST_DIR}/setup-firewall.sh"
"${DEST_DIR}/setup-fail2ban.sh"
"${DEST_DIR}/setup-logrotate.sh"
"${DEST_DIR}/setup-monitoring.sh"
"${DEST_DIR}/setup-cron.sh"

# ------------------------------------------------------------------------------
# 9. Environment file scaffolding
# ------------------------------------------------------------------------------
step "Environment scaffolding"
ENV_TARGET="/opt/vegamart/.env.production"
if [[ ! -f "$ENV_TARGET" ]]; then
  if [[ -f "${DEST_DIR}/.env.production.example" ]]; then
    cp "${DEST_DIR}/.env.production.example" "$ENV_TARGET"
    chmod 600 "$ENV_TARGET"
    ok "Created ${ENV_TARGET} from example"
  fi
else
  info "${ENV_TARGET} already exists — left untouched."
fi

# ------------------------------------------------------------------------------
# 10. Report
# ------------------------------------------------------------------------------
print_success_banner
echo "  Toolkit:  ${DEST_DIR}"
echo "  Env:      ${ENV_TARGET}   <- EDIT THIS"
echo "  Config:   ${DEST_DIR}/configs/deploy.env   <- EDIT THIS (GIT_REPO_URL, DOMAIN)"
echo "  DB pass:  ${DEST_DIR}/generated-db-password.txt"
echo ""
echo "  Next steps:"
echo "    1. nano /opt/vegamart/.env.production         (fill R2, Razorpay, SMTP, DB password)"
echo "    2. nano ${DEST_DIR}/configs/deploy.env  (set GIT_REPO_URL, DOMAIN)"
echo "    3. cd ${DEST_DIR} && ./deploy.sh"
echo ""
echo "  Manual steps only: create VPS, point DNS, fill env files, provide R2/Razorpay/SMTP."
