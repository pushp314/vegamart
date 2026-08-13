#!/usr/bin/env bash

# ==============================================================================
# restart.sh
# Safely restart services
# ==============================================================================

cd "$(dirname "${BASH_SOURCE[0]}")/.."
source deploy/lib/common.sh
source deploy/lib/pm2.sh

require_root

target=${1:-all}
log_header "VegaMart Restart: $target"

case $target in
    backend)
        log_info "Restarting backend..."
        su - vegamart -c "pm2 restart vegamart-backend"
        ;;
    frontend)
        log_info "Restarting frontend..."
        su - vegamart -c "pm2 restart vegamart-frontend"
        ;;
    nginx)
        log_info "Restarting Nginx..."
        systemctl restart nginx
        ;;
    redis)
        log_info "Restarting Redis..."
        systemctl restart redis-server
        ;;
    all|*)
        log_info "Restarting all PM2 processes and Nginx..."
        if [[ -L "/opt/vegamart/current" ]]; then
            restart_pm2 "/opt/vegamart/current"
        else
            su - vegamart -c "pm2 restart all"
        fi
        systemctl restart nginx
        ;;
esac

log_success "Restart complete."
