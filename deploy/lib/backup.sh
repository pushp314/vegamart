#!/usr/bin/env bash

# ==============================================================================
# backup.sh
# PostgreSQL backup utilities
# ==============================================================================

create_backup() {
    local backup_dir="/opt/vegamart/shared/backups"
    local timestamp
    timestamp=$(date +"%Y%m%d_%H%M%S")
    local backup_file="$backup_dir/vegamart_$timestamp.sql.gz"
    
    log_info "Creating database backup..."
    
    mkdir -p "$backup_dir"
    chown -R vegamart:vegamart "$backup_dir"

    # Extract db info from DATABASE_URL
    # Format: postgresql://user:password@host:port/dbname?schema=public
    if [[ -z "${DATABASE_URL:-}" ]]; then
        log_error "DATABASE_URL is not set. Cannot perform backup."
        return 1
    fi

    # Strip query params
    local db_url="${DATABASE_URL%%\?*}"
    
    if sudo -u postgres pg_dump -d "$db_url" | gzip > "$backup_file"; then
        log_success "Database backup created at $backup_file"
        
        # Cleanup old backups (keep last 14 days)
        find "$backup_dir" -name "*.sql.gz" -type f -mtime +14 -delete
    else
        log_error "Failed to create database backup."
        rm -f "$backup_file"
        return 1
    fi
}

restore_backup() {
    local backup_file=$1
    if [[ ! -f "$backup_file" ]]; then
        log_error "Backup file $backup_file not found."
        exit 1
    fi

    log_warn "WARNING: You are about to overwrite the production database with $backup_file."
    read -r -p "Are you absolutely sure you want to restore this backup? [y/N]: " confirm
    
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        log_info "Restore cancelled."
        exit 0
    fi

    if [[ -z "${DATABASE_URL:-}" ]]; then
        log_error "DATABASE_URL is not set. Cannot perform restore."
        exit 1
    fi

    local db_url="${DATABASE_URL%%\?*}"
    local db_name=$(echo "$db_url" | awk -F'/' '{print $NF}')

    log_info "Dropping active connections..."
    sudo -u postgres psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$db_name' AND pid <> pg_backend_pid();"

    log_info "Restoring database..."
    if gunzip -c "$backup_file" | sudo -u postgres psql -d "$db_url"; then
        log_success "Database restored successfully."
    else
        log_error "Database restoration encountered errors."
        exit 1
    fi
}
