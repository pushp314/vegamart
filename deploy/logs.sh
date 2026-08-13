#!/usr/bin/env bash

# ==============================================================================
# logs.sh
# Check VegaMart logs
# ==============================================================================

cd "$(dirname "${BASH_SOURCE[0]}")/.."
source deploy/lib/common.sh

require_root

target=${1:-all}

case $target in
    backend)
        log_info "Tailing backend logs..."
        su - vegamart -c "pm2 logs vegamart-backend"
        ;;
    frontend)
        log_info "Tailing frontend logs..."
        su - vegamart -c "pm2 logs vegamart-frontend"
        ;;
    nginx)
        log_info "Tailing Nginx logs..."
        tail -f /var/log/nginx/error.log /var/log/nginx/access.log
        ;;
    all|*)
        log_info "Tailing all PM2 logs..."
        su - vegamart -c "pm2 logs"
        ;;
esac
