#!/usr/bin/env bash

# ==============================================================================
# backup.sh
# Trigger a database backup manually
# ==============================================================================

cd "$(dirname "${BASH_SOURCE[0]}")/.."
source deploy/lib/common.sh
source deploy/lib/env.sh
source deploy/lib/backup.sh

require_root

log_header "VegaMart Backup"

load_env
create_backup
