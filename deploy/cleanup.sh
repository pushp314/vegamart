#!/usr/bin/env bash

# ==============================================================================
# cleanup.sh
# Remove old releases to save disk space
# ==============================================================================

cd "$(dirname "${BASH_SOURCE[0]}")/.."
source deploy/lib/common.sh

require_root

log_header "VegaMart Release Cleanup"

keep_releases=${KEEP_RELEASES:-2}
releases_dir="/opt/vegamart/releases"

if [[ ! -d "$releases_dir" ]]; then
    log_info "No releases directory found."
    exit 0
fi

log_info "Keeping the $keep_releases most recent releases..."

# List directories sorted by name (timestamp) in descending order, skip the first $keep_releases
releases_to_delete=$(ls -1dt "$releases_dir"/*/ | tail -n +$((keep_releases + 1)))

if [[ -z "$releases_to_delete" ]]; then
    log_info "No old releases to clean up."
    exit 0
fi

for release in $releases_to_delete; do
    # Ensure we don't delete the current active release
    if [[ "$(readlink /opt/vegamart/current)" == "${release%/}" ]]; then
        log_warn "Skipping active release: $release"
        continue
    fi
    
    log_info "Deleting old release: $release"
    rm -rf "$release"
done

log_success "Cleanup complete."
