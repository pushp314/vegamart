#!/usr/bin/env bash
# ==============================================================================
# setup-ssl.sh — obtains a Let's Encrypt certificate via Certbot (Nginx plugin)
# and configures HTTP->HTTPS. Idempotent; renewal handled by certbot.timer.
# ==============================================================================
set -Eeuo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/scripts" && pwd)/lib.sh"

require_root
load_config
require_var DOMAIN "Add 'DOMAIN=your-domain.com' to configs/deploy.env."

CERT_DIR="/etc/letsencrypt/live/${DOMAIN}"
EXTRA_DOMAINS=()
for d in ${SSL_EXTRA_DOMAINS:-}; do EXTRA_DOMAINS+=("-d" "$d"); done

step "SSL setup (Let's Encrypt / Certbot)"

apt_ensure certbot python3-certbot-nginx openssl

if [[ -f "${CERT_DIR}/fullchain.pem" ]]; then
  info "Certificate already exists for ${DOMAIN}"
  expires_on=$(openssl x509 -enddate -noout -in "${CERT_DIR}/fullchain.pem" | cut -d= -f2)
  info "Current cert expires: ${expires_on}"
else
  # Ensure DNS resolves before asking Let's Encrypt for a cert.
  if ! getent ahostsv4 "$DOMAIN" >/dev/null 2>&1; then
    die "DNS for ${DOMAIN} does not resolve to this server yet. Point the A/AAAA records at the VPS IP, wait for propagation, then re-run."
  fi

  sub "Requesting certificate for ${DOMAIN} ${EXTRA_DOMAINS[*]:-}"
  EMAIL_ARGS=()
  if [[ -n "${ADMIN_EMAIL:-}" ]]; then
    EMAIL_ARGS+=("-m" "$ADMIN_EMAIL")
  else
    EMAIL_ARGS+=("--register-unsafely-without-email")
  fi
  certbot --nginx -d "$DOMAIN" "${EXTRA_DOMAINS[@]}" \
    --redirect --non-interactive --agree-tos "${EMAIL_ARGS[@]}" \
    --keep-until-expiring
  ok "Certificate obtained"

  # Re-render the canonical config now that certs exist (certbot modified our file).
  sub "Re-applying canonical Nginx config (HTTPS mode)"
  "${DEPLOY_DIR}/scripts/nginx-config.sh"
fi

# Automatic renewal — systemd timer ships with certbot; enable it explicitly.
systemctl enable certbot.timer >/dev/null 2>&1 || true
systemctl start certbot.timer >/dev/null 2>&1 || true
sub "Renewal timer: certbot.timer $(systemctl is-active certbot.timer)"

# Dry-run renewal test (safe, idempotent).
sub "Testing renewal path (certbot renew --dry-run)"
certbot renew --dry-run >/dev/null 2>&1 && ok "Renewal dry-run passed" || warn "Dry-run returned non-zero — certificate is likely fine if recently issued."

step "SSL configured — site now reachable at https://${DOMAIN}"
