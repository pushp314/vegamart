#!/usr/bin/env bash

# ==============================================================================
# update.sh
# Fetches latest code and triggers deployment
# ==============================================================================

cd "$(dirname "${BASH_SOURCE[0]}")/.."
source deploy/lib/common.sh

require_root
acquire_lock

log_header "VegaMart Update"

log_info "Fetching latest code from repository..."
# Drop local changes if any exist in the wrapper repo
git fetch origin
git reset --hard origin/main

# Release lock before calling deploy.sh (which acquires it again)
release_lock

log_info "Triggering deployment..."
bash deploy/deploy.sh
