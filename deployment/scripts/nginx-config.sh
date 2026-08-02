#!/usr/bin/env bash
# ==============================================================================
# scripts/nginx-config.sh — renders nginx/example.conf into /etc/nginx using the
# values from configs/deploy.env. Safe to run repeatedly.
# ==============================================================================
set -Eeuo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

require_root
load_config
require_var DOMAIN

TEMPLATE="${DEPLOY_DIR}/nginx/example.conf"
SITE_DIR="/etc/nginx/sites-available"
SITE_LINK="/etc/nginx/sites-enabled"
SITE_NAME="vegamart"
SITE_FILE="${SITE_DIR}/${SITE_NAME}"
CERT_DIR="/etc/letsencrypt/live/${DOMAIN}"
SPLIT_MODE="no"
[[ -n "${API_DOMAIN:-}" ]] && SPLIT_MODE="yes"

mkdir -p "$SITE_DIR" "$SITE_LINK"

# Pick the correct rendering mode depending on whether a certificate exists yet.
if [[ -f "${CERT_DIR}/fullchain.pem" ]]; then
  MODE="ssl"
else
  MODE="http"
  warn "No SSL certificate yet — rendering HTTP-only config. Run setup-ssl.sh to obtain one."
fi

# Render tokens, then keep only the block matching the current TLS state.
TMP_OUT="$(mktemp /tmp/vegamart-nginx.XXXXXX)"
sed \
  -e "s|__DOMAIN__|${DOMAIN}|g" \
  -e "s|__API_DOMAIN__|${API_DOMAIN:-}|g" \
  -e "s|__WEB_PORT__|${WEB_PORT}|g" \
  -e "s|__API_PORT__|${API_PORT}|g" \
  -e "s|__CERT_PATH__|${CERT_DIR}|g" \
  "$TEMPLATE" > "$TMP_OUT"

# Mode selection: keep the single-domain block, or keep the split blocks.
if [[ "$SPLIT_MODE" == "yes" ]]; then
  awk '/__SINGLE_MODE__/{skip=1} /__SINGLE_MODE_END__/{skip=0; next} !skip' "$TMP_OUT" > "${TMP_OUT}.mode"
  info "Rendering split-domain config (frontend ${DOMAIN}, API ${API_DOMAIN})"
else
  awk '/__SPLIT_MODE__/{skip=1} /__SPLIT_MODE_END__/{skip=0; next} !skip' "$TMP_OUT" > "${TMP_OUT}.mode"
  info "Rendering single-domain config (${DOMAIN})"
fi
mv "${TMP_OUT}.mode" "$TMP_OUT"

if [[ "$MODE" == "ssl" ]]; then
  # Keep SSL block, drop HTTP_ONLY block.
  awk '/__HTTP_ONLY_BLOCK__/{skip=1} /__HTTP_ONLY_BLOCK_END__/{skip=0; next} !skip' "$TMP_OUT" > "${TMP_OUT}.2"
else
  # Keep HTTP_ONLY block, drop SSL block.
  awk '/__SSL_BLOCK__/{skip=1} /__SSL_BLOCK_END__/{skip=0; next} !skip' "$TMP_OUT" > "${TMP_OUT}.2"
fi
# Strip any leftover block markers from the retained block.
sed -i '/__SSL_BLOCK__/d; /__SSL_BLOCK_END__/d; /__HTTP_ONLY_BLOCK__/d; /__HTTP_ONLY_BLOCK_END__/d; /__SINGLE_MODE__/d; /__SINGLE_MODE_END__/d; /__SPLIT_MODE__/d; /__SPLIT_MODE_END__/d' "${TMP_OUT}.2"
mv "${TMP_OUT}.2" "$TMP_OUT"

mv "$TMP_OUT" "$SITE_FILE"
chmod 644 "$SITE_FILE"

# Enable the site (idempotent), remove default site.
ln -sf "$SITE_FILE" "${SITE_LINK}/${SITE_NAME}"
rm -f "${SITE_LINK}/default"

# Rate-limit zone + cache dir are created by the config; ensure the cache dir exists.
mkdir -p /var/cache/nginx/vegamart
info "Nginx site written: ${SITE_FILE} (mode=${MODE})"

if nginx -t >/dev/null 2>&1; then
  ok "nginx -t passed"
else
  error "nginx -t failed; config left in place for inspection: ${SITE_FILE}"
  nginx -t || true
  exit 1
fi
