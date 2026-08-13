#!/usr/bin/env bash

# ==============================================================================
# env.sh
# Environment validation and generation
# ==============================================================================

create_env_if_missing() {
    local shared_env="/opt/vegamart/shared/.env"
    
    if [[ ! -f "$shared_env" ]]; then
        log_info "No shared .env found. Creating from template..."
        mkdir -p "/opt/vegamart/shared"
        cp "deploy/templates/env.example" "$shared_env"
        chmod 600 "$shared_env"
        chown vegamart:vegamart "$shared_env"
        log_success "Created $shared_env"
    fi
}

load_env() {
    local shared_env="/opt/vegamart/shared/.env"
    if [[ -f "$shared_env" ]]; then
        # Load variables without exporting all of them globally to the shell, 
        # but since we need them in scripts, we export them.
        set -a
        source "$shared_env"
        set +a
    else
        log_warn "Could not load $shared_env (file not found)."
    fi
}

validate_env() {
    log_info "Validating environment variables..."
    local missing=0
    
    local required_vars=(
        "DATABASE_URL"
        "JWT_ACCESS_SECRET"
        "JWT_REFRESH_SECRET"
        "VEGAMART_DOMAIN"
    )

    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            echo -e "${RED}${var} ✗ missing${NC}"
            missing=1
        else
            echo -e "${GREEN}${var} ✓ configured${NC}"
        fi
    done

    if [[ $missing -ne 0 ]]; then
        log_error "Required environment variables are missing. Please configure /opt/vegamart/shared/.env"
        exit 1
    fi
}

distribute_env() {
    local release_dir=$1
    local shared_env="/opt/vegamart/shared/.env"
    
    log_info "Linking environment to release..."
    # The backend and frontend might expect the .env file in their roots.
    # We will symlink the shared .env into backend/ and gali-connect-main/
    ln -sf "$shared_env" "$release_dir/backend/.env"
    ln -sf "$shared_env" "$release_dir/gali-connect-main/.env"
    
    # Also create one in the root of the release for ecosystem.config.js if needed
    ln -sf "$shared_env" "$release_dir/.env"
}
