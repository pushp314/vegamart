#!/usr/bin/env bash

# ==============================================================================
# nginx.sh
# Nginx installation and configuration
# ==============================================================================

install_nginx() {
    if ! command -v nginx >/dev/null 2>&1; then
        log_info "Nginx not found. Installing..."
        apt-get install -yqq nginx
        systemctl enable nginx
        systemctl start nginx
        log_success "Nginx installed and started."
    else
        log_info "Nginx is already installed."
    fi
}

configure_nginx() {
    local domain=$1
    local config_dest="/etc/nginx/sites-available/vegamart"
    local symlink_dest="/etc/nginx/sites-enabled/vegamart"

    log_info "Configuring Nginx for domain '$domain'..."

    # Read template and replace variables
    if [[ ! -f "deploy/templates/nginx.conf" ]]; then
        log_error "Nginx template not found at deploy/templates/nginx.conf"
        exit 1
    fi

    sed -e "s/{{DOMAIN}}/${domain}/g" "deploy/templates/nginx.conf" > "$config_dest"

    if [[ ! -L "$symlink_dest" ]]; then
        ln -s "$config_dest" "$symlink_dest"
    fi

    # Remove default site
    if [[ -L "/etc/nginx/sites-enabled/default" ]]; then
        rm -f "/etc/nginx/sites-enabled/default"
    fi

    # Test configuration and reload
    if nginx -t; then
        systemctl reload nginx
        log_success "Nginx configured successfully."
    else
        log_error "Nginx configuration test failed."
        exit 1
    fi
}
