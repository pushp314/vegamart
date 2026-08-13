#!/usr/bin/env bash

# ==============================================================================
# health.sh
# Health checking utilities
# ==============================================================================

check_url_health() {
    local url=$1
    local retries=5
    local wait=2

    log_info "Checking health of $url..."
    
    for ((i=1; i<=retries; i++)); do
        if curl -sf --output /dev/null "$url"; then
            log_success "Health check passed for $url"
            return 0
        fi
        log_warn "Health check failed for $url. Retrying ($i/$retries)..."
        sleep $wait
    done
    
    log_error "Health check failed for $url after $retries attempts."
    return 1
}

verify_pm2_processes() {
    log_info "Verifying PM2 processes..."
    # Check if any processes are errored
    local errored
    errored=$(su - vegamart -c "pm2 jlist" | jq -r '.[].pm2_env.status' | grep -E 'errored|stopped' || true)
    
    if [[ -n "$errored" ]]; then
        log_error "One or more PM2 processes are not online."
        return 1
    fi
    log_success "All PM2 processes are online."
    return 0
}

post_deploy_health_check() {
    local backend_url="http://127.0.0.1:8080/api/v1/health" # We need to ensure we have a health route
    local frontend_url="http://127.0.0.1:3000/"

    # Verify PM2
    if ! verify_pm2_processes; then
        return 1
    fi

    # Wait for processes to fully boot
    sleep 3

    # Check frontend
    if ! check_url_health "$frontend_url"; then
        return 1
    fi

    # We skip backend specific health check if it doesn't exist, but usually it does.
    # Alternatively, we can check a known public endpoint.
    if ! check_url_health "http://127.0.0.1:8080/api/v1/system/settings/public"; then
        log_warn "Backend health check failed. Please ensure the backend is running correctly."
        return 1
    fi

    return 0
}
