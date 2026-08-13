#!/usr/bin/env bash

# ==============================================================================
# redis.sh
# Redis installation and secure configuration
# ==============================================================================

install_redis() {
    if ! command -v redis-server >/dev/null 2>&1; then
        log_info "Redis not found. Installing..."
        apt-get install -yqq redis-server
        systemctl enable redis-server
        log_success "Redis installed."
    else
        log_info "Redis is already installed."
    fi
}

configure_redis() {
    log_info "Configuring Redis..."
    local redis_conf="/etc/redis/redis.conf"
    local redis_password="${REDIS_PASSWORD:-}"

    if [[ -z "$redis_password" ]]; then
        redis_password=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 24)
        export REDIS_PASSWORD="$redis_password"
        log_info "Generated secure password for Redis."
    fi

    if [[ -f "$redis_conf" ]]; then
        # Ensure Redis only listens on localhost
        sed -i 's/^bind .*/bind 127.0.0.1 -::1/' "$redis_conf"
        
        # Configure password
        if grep -q "^# requirepass" "$redis_conf"; then
            sed -i "s/^# requirepass.*/requirepass $redis_password/" "$redis_conf"
        elif grep -q "^requirepass" "$redis_conf"; then
            sed -i "s/^requirepass.*/requirepass $redis_password/" "$redis_conf"
        else
            echo "requirepass $redis_password" >> "$redis_conf"
        fi

        systemctl restart redis-server
        log_success "Redis configured securely."
    else
        log_warn "Redis config file not found at $redis_conf. Skipping configuration."
    fi

    export REDIS_URL="redis://:${redis_password}@127.0.0.1:6379"
}
