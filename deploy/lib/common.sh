#!/usr/bin/env bash

# ==============================================================================
# common.sh
# Common utility functions for VegaMart deployment
# ==============================================================================

# Strict mode
set -Eeuo pipefail
trap 'error_handler $? $LINENO $BASH_LINENO "$BASH_COMMAND" $(printf "::%s" ${FUNCNAME[@]:-})' ERR

# Colors
NC='\033[0m'
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'

# Logging
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1" >&2
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

log_header() {
    echo -e "\n${BOLD}${CYAN}=== $1 ===${NC}"
}

# Error Handler
error_handler() {
    local exit_code=$1
    local line_no=$2
    local bash_lineno=$3
    local last_command=$4
    local func_trace=$5

    log_error "Command '${last_command}' failed with exit code ${exit_code} at line ${line_no}."
    
    # Unlock if locked
    if [[ -f "/var/lock/vegamart-deploy.lock" ]]; then
        rm -f "/var/lock/vegamart-deploy.lock"
        log_info "Removed deployment lock."
    fi

    exit "${exit_code}"
}

# Ensure running as root
require_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root or with sudo."
        exit 1
    fi
}

# Acquire lock
acquire_lock() {
    local lock_file="/var/lock/vegamart-deploy.lock"
    if [[ -f "$lock_file" ]]; then
        local pid
        pid=$(cat "$lock_file")
        if kill -0 "$pid" 2>/dev/null; then
            log_error "Another VegaMart deployment is currently running (PID $pid)."
            exit 1
        else
            log_warn "Stale lock file found. Removing..."
            rm -f "$lock_file"
        fi
    fi
    echo $$ > "$lock_file"
}

# Release lock
release_lock() {
    local lock_file="/var/lock/vegamart-deploy.lock"
    rm -f "$lock_file"
}

# Prompt user for input if not set
prompt_if_empty() {
    local var_name=$1
    local prompt_text=$2
    local is_secret=${3:-false}
    local value="${!var_name:-}"

    if [[ -z "$value" ]]; then
        if [[ "$is_secret" == "true" ]]; then
            read -r -s -p "${prompt_text}: " value
            echo ""
        else
            read -r -p "${prompt_text}: " value
        fi
        export "$var_name"="$value"
    fi
}
