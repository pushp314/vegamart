#!/usr/bin/env bash

# ==============================================================================
# status.sh
# Check VegaMart production status
# ==============================================================================

cd "$(dirname "${BASH_SOURCE[0]}")/.."
source deploy/lib/common.sh
source deploy/lib/health.sh

require_root

log_header "VegaMart Production Status"
echo "───────────────────────────"

# Application Status
if [[ -L "/opt/vegamart/current" ]]; then
    echo -e "Application      ${GREEN}✓ Running${NC}"
    release=$(basename "$(readlink /opt/vegamart/current)")
    echo -e "Release          $release"
else
    echo -e "Application      ${RED}✗ Not found${NC}"
fi

# Services
if systemctl is-active --quiet postgresql; then
    echo -e "PostgreSQL       ${GREEN}✓ Healthy${NC}"
else
    echo -e "PostgreSQL       ${RED}✗ Offline${NC}"
fi

if systemctl is-active --quiet redis-server; then
    echo -e "Redis            ${GREEN}✓ Healthy${NC}"
else
    echo -e "Redis            ${RED}✗ Offline${NC}"
fi

if verify_pm2_processes >/dev/null 2>&1; then
    echo -e "PM2              ${GREEN}✓ Online${NC}"
else
    echo -e "PM2              ${RED}✗ Offline / Issues Detected${NC}"
fi

if systemctl is-active --quiet nginx; then
    echo -e "Nginx            ${GREEN}✓ Running${NC}"
else
    echo -e "Nginx            ${RED}✗ Offline${NC}"
fi

# System Stats
disk_free=$(df -h / | awk 'NR==2 {print $4}')
echo -e "Disk             ${GREEN}✓ $disk_free free${NC}"

mem_usage=$(free | awk 'NR==2{printf "%.2f%%", $3*100/$2 }')
echo -e "Memory           ${GREEN}✓ $mem_usage used${NC}"
