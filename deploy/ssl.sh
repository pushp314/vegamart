#!/usr/bin/env bash

# ==============================================================================
# ssl.sh
# Request or renew SSL certificates
# ==============================================================================

cd "$(dirname "${BASH_SOURCE[0]}")/.."
source deploy/lib/common.sh
source deploy/lib/env.sh
source deploy/lib/ssl.sh

require_root

log_header "VegaMart SSL Configuration"

load_env

if [[ -z "${VEGAMART_DOMAIN:-}" ]]; then
    log_error "VEGAMART_DOMAIN is not set in /opt/vegamart/shared/.env"
    exit 1
fi

if [[ -z "${SSL_EMAIL:-}" ]]; then
    log_error "SSL_EMAIL is not set in /opt/vegamart/shared/.env"
    exit 1
fi

install_certbot
configure_ssl "$VEGAMART_DOMAIN" "$SSL_EMAIL"
