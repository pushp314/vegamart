#!/usr/bin/env bash

# ==============================================================================
# node.sh
# Node.js and PM2 installation
# ==============================================================================

# Install Node.js v20 LTS
install_node() {
    if ! command -v node >/dev/null 2>&1; then
        log_info "Node.js not found. Installing Node.js 20.x from NodeSource..."
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt-get install -yqq nodejs
        log_success "Node.js installed: $(node --version)"
    else
        local node_version
        node_version=$(node --version)
        log_info "Node.js is already installed: $node_version"
        # We could strictly check for v20 here, but typically if it's installed, we assume it's acceptable.
        if [[ ! "$node_version" =~ ^v20\. ]]; then
            log_warn "Node.js version is not v20.x. This might cause compatibility issues."
        fi
    fi

    if ! command -v npm >/dev/null 2>&1; then
        log_error "npm is not installed. This is unexpected."
        exit 1
    fi
}

# Install PM2 globally
install_pm2() {
    if ! command -v pm2 >/dev/null 2>&1; then
        log_info "PM2 not found. Installing globally via npm..."
        npm install -g pm2
        log_success "PM2 installed: $(pm2 -v)"
    else
        log_info "PM2 is already installed: $(pm2 -v)"
    fi
}

# Configure PM2 to start on boot
configure_pm2_startup() {
    local username="vegamart"
    log_info "Configuring PM2 startup for user '$username'..."
    
    # We must run the PM2 startup command. To do this for the 'vegamart' user, 
    # we first generate the startup script for that user.
    # Note: `pm2 startup` generates a command we need to run as root.
    env PATH=$PATH:/usr/bin pm2 startup systemd -u "$username" --hp "/home/$username" || true
    
    # We save the process list for the user so it restores on reboot.
    # Since we might not have any processes yet during installation, this just creates the dump file.
    su - "$username" -c "pm2 save" || true

    log_success "PM2 startup configured."
}
