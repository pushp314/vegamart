#!/usr/bin/env bash

# ==============================================================================
# pm2.sh
# PM2 process management
# ==============================================================================

restart_pm2() {
    local release_dir=$1
    local username="vegamart"
    log_info "Restarting PM2 processes using config in $release_dir..."

    # The ecosystem.config.js is in the release root
    # PM2 ignores exec_mode changes on reload, so we must delete and start fresh
    if su - "$username" -c "pm2 delete vegamart-backend vegamart-frontend || true; cd $release_dir && pm2 start ecosystem.config.js"; then
        log_success "PM2 processes started/reloaded."
        su - "$username" -c "pm2 save"
    else
        log_error "Failed to start/reload PM2 processes."
        exit 1
    fi
}
