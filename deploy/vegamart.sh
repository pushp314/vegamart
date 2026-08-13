#!/usr/bin/env bash

# ==============================================================================
# vegamart
# Single command wrapper for VegaMart deployment system
# ==============================================================================

# Locate the deploy directory relative to this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VEGAMART_ROOT="$(dirname "$SCRIPT_DIR")"

# Ensure we are running as root
if [[ $EUID -ne 0 ]]; then
    echo -e "\033[0;31m[ERROR]\033[0m This command must be run with sudo." >&2
    exit 1
fi

command=$1
shift || true

print_usage() {
    echo -e "\033[1;36mVegaMart Production Deployment CLI\033[0m"
    echo ""
    echo "Usage: sudo vegamart <command> [args]"
    echo ""
    echo "Commands:"
    echo "  install    Fresh server provisioning and first deployment"
    echo "  deploy     Trigger an internal deployment from the current directory"
    echo "  update     Fetch latest code and deploy"
    echo "  rollback   Rollback to the previous healthy release"
    echo "  status     Check production status"
    echo "  health     Run application health checks"
    echo "  doctor     Run comprehensive system diagnostics"
    echo "  logs       View PM2 and Nginx logs [backend|frontend|nginx|all]"
    echo "  restart    Safely restart services [backend|frontend|nginx|redis|all]"
    echo "  backup     Create a PostgreSQL database backup"
    echo "  restore    Restore a PostgreSQL database backup"
    echo "  ssl        Request or renew SSL certificates via Let's Encrypt"
    echo "  cleanup    Remove old releases to save disk space"
    echo "  help       Show this help message"
    echo ""
}

case $command in
    install)  bash "$SCRIPT_DIR/install.sh" "$@" ;;
    deploy)   bash "$SCRIPT_DIR/deploy.sh" "$@" ;;
    update)   bash "$SCRIPT_DIR/update.sh" "$@" ;;
    rollback) bash "$SCRIPT_DIR/rollback.sh" "$@" ;;
    status)   bash "$SCRIPT_DIR/status.sh" "$@" ;;
    health)   bash "$SCRIPT_DIR/health.sh" "$@" ;;
    doctor)   bash "$SCRIPT_DIR/doctor.sh" "$@" ;;
    logs)     bash "$SCRIPT_DIR/logs.sh" "$@" ;;
    restart)  bash "$SCRIPT_DIR/restart.sh" "$@" ;;
    backup)   bash "$SCRIPT_DIR/backup.sh" "$@" ;;
    restore)  bash "$SCRIPT_DIR/restore.sh" "$@" ;;
    ssl)      bash "$SCRIPT_DIR/ssl.sh" "$@" ;;
    cleanup)  bash "$SCRIPT_DIR/cleanup.sh" "$@" ;;
    help|*)   print_usage ;;
esac
