#!/usr/bin/env bash

# ==============================================================================
# restore.sh
# Restore a PostgreSQL database backup
# ==============================================================================

cd "$(dirname "${BASH_SOURCE[0]}")/.."
source deploy/lib/common.sh
source deploy/lib/env.sh
source deploy/lib/backup.sh

require_root

log_header "VegaMart Database Restore"

backup_file=$1

if [[ -z "$backup_file" ]]; then
    log_info "Available backups:"
    ls -lh /opt/vegamart/shared/backups/ | awk '{print $9 " (" $5 ")"}'
    echo ""
    log_error "Please provide a backup file path to restore."
    echo "Usage: sudo vegamart restore /opt/vegamart/shared/backups/vegamart_XYZ.sql.gz"
    exit 1
fi

load_env
restore_backup "$backup_file"
