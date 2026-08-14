#!/usr/bin/env bash

# ==============================================================================
# postgres.sh
# PostgreSQL installation, database creation, user creation, migrations
# ==============================================================================

install_postgres() {
    if ! command -v psql >/dev/null 2>&1; then
        log_info "PostgreSQL not found. Installing..."
        apt-get install -yqq postgresql postgresql-contrib
        systemctl enable postgresql
        systemctl start postgresql
        log_success "PostgreSQL installed and started."
    else
        log_info "PostgreSQL is already installed."
    fi
}

configure_postgres() {
    local db_name="vegamart"
    local db_user="vegamart_user"
    local db_password="${POSTGRES_PASSWORD:-}"

    if [[ -z "$db_password" ]]; then
        # Generate a random password if not supplied
        db_password=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 24)
        export POSTGRES_PASSWORD="$db_password"
        log_info "Generated secure password for PostgreSQL user '$db_user'."
    fi

    log_info "Configuring PostgreSQL user and database..."

    # Create user if not exists
    if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$db_user'" | grep -q 1; then
        sudo -u postgres psql -c "CREATE USER $db_user WITH PASSWORD '$db_password';"
        log_success "PostgreSQL user '$db_user' created."
    else
        log_info "PostgreSQL user '$db_user' already exists. Updating password..."
        sudo -u postgres psql -c "ALTER USER $db_user WITH PASSWORD '$db_password';"
    fi

    # Create database if not exists
    if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$db_name'" | grep -q 1; then
        sudo -u postgres psql -c "CREATE DATABASE $db_name OWNER $db_user;"
        log_success "PostgreSQL database '$db_name' created."
    else
        log_info "PostgreSQL database '$db_name' already exists."
    fi

    export DATABASE_URL="postgresql://${db_user}:${db_password}@127.0.0.1:5432/${db_name}?schema=public"
}

run_migrations() {
    local release_dir=$1
    log_info "Running Prisma migrations..."

    # We must run migrations as the application user to prevent permission issues
    if su - vegamart -c "cd $release_dir/backend && npx prisma migrate deploy"; then
        log_success "Database migrations completed successfully."
        log_info "Running database seed..."
        if su - vegamart -c "cd $release_dir/backend && npm run prisma:seed"; then
            log_success "Database seed completed successfully."
        else
            log_error "Database seed failed."
            exit 1
        fi
    else
        log_error "Database migration failed."
        exit 1
    fi
}
