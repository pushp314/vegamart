#!/usr/bin/env bash

# ==============================================================================
# rollback.sh
# Rollback to a previous release
# ==============================================================================

cd "$(dirname "${BASH_SOURCE[0]}")/.."
source deploy/lib/common.sh
source deploy/lib/pm2.sh
source deploy/lib/health.sh

require_root
acquire_lock

log_header "VegaMart Rollback"

releases_dir="/opt/vegamart/releases"
current_link="/opt/vegamart/current"

if [[ ! -L "$current_link" ]]; then
    log_error "No active release found at $current_link."
    exit 1
fi

current_release=$(basename "$(readlink "$current_link")")
log_info "Current release: $current_release"

# Find the previous release
# We list directories, sort them, and pick the one before current
previous_release=$(ls -1 "$releases_dir" | grep -B 1 "^$current_release$" | head -n 1)

if [[ -z "$previous_release" ]] || [[ "$previous_release" == "$current_release" ]]; then
    log_error "No previous release found to rollback to."
    exit 1
fi

log_warn "WARNING: Database migrations are NOT automatically rolled back."
log_warn "If the schema is incompatible with the previous release, the app may crash."
read -r -p "Are you sure you want to rollback to $previous_release? [y/N]: " confirm

if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    log_info "Rollback cancelled."
    exit 0
fi

log_info "Rolling back to $previous_release..."
ln -sfn "$releases_dir/$previous_release" "$current_link"
chown -h vegamart:vegamart "$current_link"

restart_pm2 "$current_link"

if post_deploy_health_check; then
    log_success "Rollback successful. $previous_release is now active."
else
    log_error "Rollback release is unhealthy!"
fi

release_lock
