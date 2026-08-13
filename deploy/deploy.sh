#!/usr/bin/env bash

# ==============================================================================
# deploy.sh
# Core atomic release deployment
# ==============================================================================

cd "$(dirname "${BASH_SOURCE[0]}")/.."
source deploy/lib/common.sh
source deploy/lib/env.sh
source deploy/lib/postgres.sh
source deploy/lib/pm2.sh
source deploy/lib/health.sh
source deploy/lib/backup.sh
source deploy/lib/nginx.sh

require_root
acquire_lock

log_header "VegaMart Deployment"

load_env
validate_env

timestamp=$(date +"%Y%m%d-%H%M%S")
git_sha=$(git rev-parse --short HEAD)
release_id="${timestamp}-${git_sha}"
release_dir="/opt/vegamart/releases/$release_id"
current_link="/opt/vegamart/current"
shared_dir="/opt/vegamart/shared"

log_info "Creating new release: $release_id"
mkdir -p "/opt/vegamart/releases"
cp -r . "$release_dir"
chown -R vegamart:vegamart "$release_dir"

distribute_env "$release_dir"

# Backend Build
log_info "Installing backend dependencies and building..."
su - vegamart -c "cd $release_dir/backend && npm install --no-audit --no-fund"
su - vegamart -c "cd $release_dir/backend && npm run build"

# Frontend Build
log_info "Installing frontend dependencies and building..."
su - vegamart -c "cd $release_dir/gali-connect-main && npm install --no-audit --no-fund"
su - vegamart -c "cd $release_dir/gali-connect-main && NITRO_PRESET=node-server npm run build"

# Database Backup (if existing db)
if [[ -L "$current_link" ]]; then
    create_backup || log_warn "Backup failed, continuing anyway..."
fi

# Migrations
run_migrations "$release_dir"

# Copy ecosystem template
cp deploy/templates/ecosystem.config.js "$release_dir/ecosystem.config.js"
chown vegamart:vegamart "$release_dir/ecosystem.config.js"

# Switch release
log_info "Switching active release..."
ln -sfn "$release_dir" "$current_link"
chown -h vegamart:vegamart "$current_link"

# Ensure Nginx config is up to date based on env
configure_nginx "${VEGAMART_DOMAIN}"

# Restart services
restart_pm2 "$current_link"

# Verify health
log_info "Running post-deployment health checks..."
if post_deploy_health_check; then
    log_success "Deployment $release_id active and healthy!"
else
    log_error "Deployment unhealthy. You may need to rollback."
    log_info "To rollback, run: sudo vegamart rollback"
    exit 1
fi

release_lock
