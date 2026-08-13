#!/usr/bin/env bash

# ==============================================================================
# install.sh
# Fresh server provisioning and first deployment
# ==============================================================================

cd "$(dirname "${BASH_SOURCE[0]}")/.."
source deploy/lib/common.sh
source deploy/lib/os.sh
source deploy/lib/node.sh
source deploy/lib/postgres.sh
source deploy/lib/redis.sh
source deploy/lib/nginx.sh
source deploy/lib/env.sh

require_root
acquire_lock

log_header "VegaMart Production Setup"

# OS & Dependencies
check_os
install_system_deps
setup_app_user

# Prompt for minimal interactive variables if not automated
prompt_if_empty "VEGAMART_DOMAIN" "Domain (e.g., example.com)"
prompt_if_empty "SSL_EMAIL" "SSL Email (for Let's Encrypt)"
prompt_if_empty "POSTGRES_PASSWORD" "PostgreSQL password (leave empty to auto-generate)" true

# Node.js
install_node
install_pm2

# Databases
install_postgres
configure_postgres
install_redis
configure_redis

# Nginx
install_nginx

# Environment
create_env_if_missing

# Write auto-generated values back to the env file securely
sed -i "s|^DATABASE_URL=.*|DATABASE_URL=${DATABASE_URL}|" /opt/vegamart/shared/.env || echo "DATABASE_URL=${DATABASE_URL}" >> /opt/vegamart/shared/.env
sed -i "s|^REDIS_URL=.*|REDIS_URL=${REDIS_URL}|" /opt/vegamart/shared/.env || echo "REDIS_URL=${REDIS_URL}" >> /opt/vegamart/shared/.env
sed -i "s|^VEGAMART_DOMAIN=.*|VEGAMART_DOMAIN=${VEGAMART_DOMAIN}|" /opt/vegamart/shared/.env || echo "VEGAMART_DOMAIN=${VEGAMART_DOMAIN}" >> /opt/vegamart/shared/.env
sed -i "s|^SSL_EMAIL=.*|SSL_EMAIL=${SSL_EMAIL}|" /opt/vegamart/shared/.env || echo "SSL_EMAIL=${SSL_EMAIL}" >> /opt/vegamart/shared/.env

load_env

# Firewall
configure_firewall

# Trigger the first deployment
log_info "Infrastructure setup complete. Starting first deployment..."
release_lock
bash deploy/deploy.sh

log_success "VegaMart installation and initial deployment completed successfully."
echo -e "\n${CYAN}Next steps:${NC}"
echo -e "1. Configure the remaining secrets in /opt/vegamart/shared/.env"
echo -e "2. Run 'sudo vegamart update' to apply the new secrets."
echo -e "3. Run 'sudo vegamart ssl' once DNS resolves to this server to enable HTTPS."
