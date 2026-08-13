#!/usr/bin/env bash

# ==============================================================================
# health.sh
# Check application health
# ==============================================================================

cd "$(dirname "${BASH_SOURCE[0]}")/.."
source deploy/lib/common.sh
source deploy/lib/health.sh

require_root

log_header "VegaMart Health Check"

if post_deploy_health_check; then
    log_success "System is healthy!"
else
    log_error "System health check failed!"
    exit 1
fi
