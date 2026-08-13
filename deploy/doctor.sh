#!/usr/bin/env bash

# ==============================================================================
# doctor.sh
# Comprehensive system diagnostics
# ==============================================================================

cd "$(dirname "${BASH_SOURCE[0]}")/.."
source deploy/lib/common.sh

require_root

log_header "VegaMart System Doctor"

check_cmd() {
    local cmd=$1
    if command -v "$cmd" >/dev/null 2>&1; then
        echo -e "${GREEN}✓ $cmd is installed ($( $cmd --version 2>&1 | head -n 1 | awk '{print $1" "$2" "$3}' | xargs ))${NC}"
    else
        echo -e "${RED}✗ $cmd is missing${NC}"
    fi
}

check_service() {
    local svc=$1
    if systemctl is-active --quiet "$svc"; then
        echo -e "${GREEN}✓ $svc service is running${NC}"
    else
        echo -e "${RED}✗ $svc service is not running${NC}"
    fi
}

echo -e "\n${BOLD}System Dependencies:${NC}"
check_cmd "node"
check_cmd "npm"
check_cmd "pm2"
check_cmd "nginx"
check_cmd "psql"
check_cmd "redis-server"
check_cmd "certbot"

echo -e "\n${BOLD}Services:${NC}"
check_service "nginx"
check_service "postgresql"
check_service "redis-server"

echo -e "\n${BOLD}Disk Space:${NC}"
df -h / | tail -n 1 | awk '{print "Free: "$4" (Total: "$2", Used: "$5")"}'

echo -e "\n${BOLD}Memory:${NC}"
free -h | awk '/^Mem:/ {print "Free: "$4" (Total: "$2", Used: "$3")"}'

echo -e "\n${BOLD}Environment Configured:${NC}"
if [[ -f "/opt/vegamart/shared/.env" ]]; then
    echo -e "${GREEN}✓ /opt/vegamart/shared/.env exists${NC}"
else
    echo -e "${RED}✗ /opt/vegamart/shared/.env is missing${NC}"
fi

echo -e "\n${BOLD}Releases:${NC}"
if [[ -d "/opt/vegamart/releases" ]]; then
    ls -1 "/opt/vegamart/releases" | sed 's/^/  /'
else
    echo "  None"
fi

if [[ -L "/opt/vegamart/current" ]]; then
    echo -e "\nCurrent active release: $(basename "$(readlink /opt/vegamart/current)")"
else
    echo -e "\n${RED}No active release linked!${NC}"
fi
