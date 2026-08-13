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

# CLI Tool
log_info "Installing vegamart CLI tool..."
ln -sf "$(pwd)/deploy/vegamart.sh" /usr/local/bin/vegamart
chmod +x "$(pwd)/deploy/vegamart.sh"

# Environment
create_env_if_missing

# Write auto-generated values back to the env file securely
sed -i "s|^DATABASE_URL=.*|DATABASE_URL=${DATABASE_URL}|" /opt/vegamart/shared/.env || echo "DATABASE_URL=${DATABASE_URL}" >> /opt/vegamart/shared/.env
sed -i "s|^REDIS_URL=.*|REDIS_URL=${REDIS_URL}|" /opt/vegamart/shared/.env || echo "REDIS_URL=${REDIS_URL}" >> /opt/vegamart/shared/.env
sed -i "s|^VEGAMART_DOMAIN=.*|VEGAMART_DOMAIN=${VEGAMART_DOMAIN}|" /opt/vegamart/shared/.env || echo "VEGAMART_DOMAIN=${VEGAMART_DOMAIN}" >> /opt/vegamart/shared/.env
sed -i "s|^SSL_EMAIL=.*|SSL_EMAIL=${SSL_EMAIL}|" /opt/vegamart/shared/.env || echo "SSL_EMAIL=${SSL_EMAIL}" >> /opt/vegamart/shared/.env

# Update URLs based on domain structure
sed -i "s|^CLIENT_URL=.*|CLIENT_URL=https://${VEGAMART_DOMAIN}|" /opt/vegamart/shared/.env || echo "CLIENT_URL=https://${VEGAMART_DOMAIN}" >> /opt/vegamart/shared/.env
sed -i "s|^APP_URL=.*|APP_URL=https://api.${VEGAMART_DOMAIN}|" /opt/vegamart/shared/.env || echo "APP_URL=https://api.${VEGAMART_DOMAIN}" >> /opt/vegamart/shared/.env
sed -i "s|^VITE_API_BASE_URL=.*|VITE_API_BASE_URL=https://api.${VEGAMART_DOMAIN}/api/v1|" /opt/vegamart/shared/.env || echo "VITE_API_BASE_URL=https://api.${VEGAMART_DOMAIN}/api/v1" >> /opt/vegamart/shared/.env

# Patch any empty R2 or Razorpay credentials in existing .env files with placeholders to prevent backend crashes
sed -i "s|^R2_ACCOUNT_ID=$|R2_ACCOUNT_ID=placeholder|" /opt/vegamart/shared/.env
sed -i "s|^R2_ACCESS_KEY_ID=$|R2_ACCESS_KEY_ID=placeholder|" /opt/vegamart/shared/.env
sed -i "s|^R2_SECRET_ACCESS_KEY=$|R2_SECRET_ACCESS_KEY=placeholder|" /opt/vegamart/shared/.env
sed -i "s|^R2_BUCKET_NAME=$|R2_BUCKET_NAME=vegamart|" /opt/vegamart/shared/.env
sed -i "s|^R2_PUBLIC_URL=$|R2_PUBLIC_URL=https://cdn.example.com|" /opt/vegamart/shared/.env
sed -i "s|^RAZORPAY_KEY_ID=$|RAZORPAY_KEY_ID=placeholder|" /opt/vegamart/shared/.env
sed -i "s|^RAZORPAY_KEY_SECRET=$|RAZORPAY_KEY_SECRET=placeholder|" /opt/vegamart/shared/.env
sed -i "s|^RAZORPAY_WEBHOOK_SECRET=$|RAZORPAY_WEBHOOK_SECRET=placeholder|" /opt/vegamart/shared/.env

# Generate secure JWT secrets if still using defaults
if grep -q "change_me_access_secret_at_least_32_chars_long" /opt/vegamart/shared/.env; then
    NEW_JWT_ACCESS=$(openssl rand -hex 32)
    sed -i "s|^JWT_ACCESS_SECRET=.*|JWT_ACCESS_SECRET=${NEW_JWT_ACCESS}|" /opt/vegamart/shared/.env
fi

if grep -q "change_me_refresh_secret_at_least_32_chars_long" /opt/vegamart/shared/.env; then
    NEW_JWT_REFRESH=$(openssl rand -hex 32)
    sed -i "s|^JWT_REFRESH_SECRET=.*|JWT_REFRESH_SECRET=${NEW_JWT_REFRESH}|" /opt/vegamart/shared/.env
fi

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
