#!/usr/bin/env bash

# ==============================================================================
# os.sh
# OS checks, system dependency installation, security hardening
# ==============================================================================

# Verify Ubuntu and its version
check_os() {
    log_info "Checking OS compatibility..."
    if [[ ! -f /etc/os-release ]]; then
        log_error "Unsupported OS. This script requires Ubuntu 22.04 LTS or 24.04 LTS."
        exit 1
    fi

    . /etc/os-release
    if [[ "$ID" != "ubuntu" ]]; then
        log_error "Unsupported OS: $ID. This script requires Ubuntu."
        exit 1
    fi

    if [[ "$VERSION_ID" != "22.04" && "$VERSION_ID" != "24.04" ]]; then
        log_error "Unsupported Ubuntu version: $VERSION_ID. Required: 22.04 or 24.04."
        exit 1
    fi

    log_success "OS check passed: Ubuntu $VERSION_ID."
}

# Install essential system dependencies
install_system_deps() {
    log_info "Updating package lists..."
    apt-get update -yqq

    log_info "Installing system dependencies..."
    apt-get install -yqq curl wget git ufw jq unzip tar build-essential ca-certificates gnupg lsb-release
    log_success "System dependencies installed."
}

# Configure firewall
configure_firewall() {
    log_info "Configuring UFW firewall..."
    
    # Ensure SSH is allowed so we don't lock ourselves out
    ufw allow OpenSSH
    ufw allow 22/tcp
    ufw allow 80/tcp
    ufw allow 443/tcp

    # Deny external access to internal services just in case
    ufw deny 5432/tcp
    ufw deny 6379/tcp

    ufw --force enable
    log_success "Firewall configured (Ports 22, 80, 443 open. 5432, 6379 blocked from outside)."
}

# Create a dedicated application user if it doesn't exist
setup_app_user() {
    local username="vegamart"
    if ! id -u "$username" >/dev/null 2>&1; then
        log_info "Creating dedicated application user '$username'..."
        useradd -m -s /bin/bash "$username"
        log_success "User '$username' created."
    else
        log_info "User '$username' already exists."
    fi
    
    # Allow the user to restart PM2 processes if needed, but restrict full root
    # For this deployment model, PM2 will run as the vegamart user.
}
