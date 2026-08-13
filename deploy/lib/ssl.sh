#!/usr/bin/env bash

# ==============================================================================
# ssl.sh
# SSL configuration with Let's Encrypt / Certbot
# ==============================================================================

install_certbot() {
    if ! command -v certbot >/dev/null 2>&1; then
        log_info "Certbot not found. Installing..."
        apt-get install -yqq certbot python3-certbot-nginx
        log_success "Certbot installed."
    else
        log_info "Certbot is already installed."
    fi
}

configure_ssl() {
    local domain=$1
    local email=$2

    log_info "Configuring SSL for domain '$domain'..."

    if [[ -z "$domain" ]]; then
        log_error "Domain is required for SSL configuration."
        exit 1
    fi

    if [[ -z "$email" ]]; then
        log_error "Email is required for Let's Encrypt registration."
        exit 1
    fi

    if certbot --nginx -d "$domain" --non-interactive --agree-tos -m "$email" --redirect; then
        log_success "SSL configured successfully for '$domain'."
    else
        log_warn "Certbot failed. This may happen if DNS hasn't propagated yet."
        log_warn "You can retry later by running: sudo vegamart ssl"
    fi
}
