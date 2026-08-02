#!/usr/bin/env bash
# ==============================================================================
# Vegamart Deployment Toolkit — shared helpers
# Source this file from every script:
#   source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"
# ==============================================================================

set -Eeuo pipefail

DEPLOY_VERSION="1.0.0"

# ------------------------------------------------------------------------------
# Colors (auto-disable when not a TTY)
# ------------------------------------------------------------------------------
if [[ -t 1 ]]; then
  readonly C_RESET=$'\e[0m' C_RED=$'\e[1;31m' C_GREEN=$'\e[1;32m'
  readonly C_YELLOW=$'\e[1;33m' C_BLUE=$'\e[1;34m' C_CYAN=$'\e[1;36m'
  readonly C_BOLD=$'\e[1m' C_DIM=$'\e[2m'
else
  readonly C_RESET="" C_RED="" C_GREEN="" C_YELLOW="" C_BLUE="" C_CYAN="" C_BOLD="" C_DIM=""
fi

# ------------------------------------------------------------------------------
# Logging — every script logs to deployment/logs/<script>.log
# ------------------------------------------------------------------------------
SCRIPT_NAME="$(basename "${BASH_SOURCE[1]:-$0}" .sh)"
DEPLOY_LOGS_DIR="${DEPLOY_LOGS_DIR:-/opt/vegamart/logs}"
export DEPLOY_LOGS_DIR
mkdir -p "$DEPLOY_LOGS_DIR"
LOG_FILE="${DEPLOY_LOGS_DIR}/${SCRIPT_NAME}.log"
export LOG_FILE

log()  { local lvl="$1"; shift; printf '%s [%-5s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$lvl" "$*" | tee -a "$LOG_FILE"; }
info() { log INFO  "$*"; }
warn() { log WARN  "${C_YELLOW}$*${C_RESET}"; }
error(){ log ERROR "${C_RED}$*${C_RESET}"; }
ok()   { log OK    "${C_GREEN}$*${C_RESET}"; }
step() { printf '%s\n' "${C_BOLD}── $* ──${C_RESET}" | tee -a "$LOG_FILE"; }
sub()  { printf '  %s\n' "${C_CYAN}→ $*${C_RESET}" | tee -a "$LOG_FILE"; }
die()  { error "$*"; exit 1; }

# ------------------------------------------------------------------------------
# Path resolution — works regardless of where the script is invoked from.
# SCRIPT_DIR is the directory that contains the *deployment* toolkit root.
# ------------------------------------------------------------------------------
LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export LIB_DIR
export DEPLOY_DIR="$(cd "$LIB_DIR/.." && pwd)"

# ------------------------------------------------------------------------------
# Primitives
# ------------------------------------------------------------------------------
require_root() {
  if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
    die "This script must be run as root (e.g. 'sudo $0 $*')."
  fi
}

command_exists() { command -v "$1" >/dev/null 2>&1; }

apt_ensure() {
  # apt_ensure pkg1 pkg2 ...  -> installs any that are missing (idempotent)
  local missing=() p
  for p in "$@"; do
    dpkg -s "$p" >/dev/null 2>&1 || missing+=("$p")
  done
  if (( ${#missing[@]} == 0 )); then
    info "Packages already installed: $*"
    return 0
  fi
  info "Installing packages: ${missing[*]}"
  DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends "${missing[@]}" >/dev/null
  ok "Installed: ${missing[*]}"
}

parse_bool() {
  # parse_bool VALUE DEFAULT -> prints 1/0. Accepts yes/no/true/false/1/0.
  local val="${1:-}" def="${2:-no}"
  case "${val,,}" in
    yes|true|1) echo 1 ;;
    no|false|0) echo 0 ;;
    "")          echo "$([ "$def" = "yes" ] && echo 1 || echo 0)" ;;
    *)           echo "$([ "$def" = "yes" ] && echo 1 || echo 0)" ;;
  esac
}

require_var() {
  local name="$1" hint="${2:-}"
  if [[ -z "${!name:-}" ]]; then
    die "Missing required config value '$name'. ${hint}Edit 'configs/deploy.env' (or '.env.production') and re-run."
  fi
}

# ------------------------------------------------------------------------------
# Configuration loading
# ------------------------------------------------------------------------------
CONFIG_FILE="${CONFIG_FILE:-${DEPLOY_DIR}/configs/deploy.env}"
load_config() {
  if [[ ! -f "$CONFIG_FILE" ]]; then
    if [[ -f "${DEPLOY_DIR}/configs/deploy.env.example" ]]; then
      cp "${DEPLOY_DIR}/configs/deploy.env.example" "$CONFIG_FILE"
      warn "Created '$CONFIG_FILE' from example — review and set GIT_REPO_URL and DOMAIN."
    else
      die "Configuration file '$CONFIG_FILE' not found."
    fi
  fi
  # shellcheck disable=SC1090
  set -a; source "$CONFIG_FILE"; set +a

  APP_BASE_DIR="${APP_BASE_DIR:-/opt/vegamart}"
  DEPLOY_DIR="${DEPLOY_DIR:-${APP_BASE_DIR}/deploy}"
  RELEASES_DIR="${APP_BASE_DIR}/releases"
  BACKUPS_DIR="${APP_BASE_DIR}/backups"
  LOGS_DIR="${APP_BASE_DIR}/logs"
  CONFIGS_DIR="${APP_BASE_DIR}/configs"
  TMP_DIR="${APP_BASE_DIR}/tmp"
  CURRENT_LINK="${RELEASES_DIR}/current"
  ENV_FILE="${APP_BASE_DIR}/.env.production"
  DB_PASSWORD_FILE="${DB_PASSWORD_FILE:-${DEPLOY_DIR}/generated-db-password.txt}"
  API_PORT="${API_PORT:-8080}"
  WEB_PORT="${WEB_PORT:-3000}"
  DOMAIN="${DOMAIN:-}"
  PM2_BACKEND_INSTANCES="${PM2_BACKEND_INSTANCES:-2}"
  export APP_BASE_DIR RELEASES_DIR BACKUPS_DIR LOGS_DIR CONFIGS_DIR TMP_DIR CURRENT_LINK ENV_FILE DB_PASSWORD_FILE API_PORT WEB_PORT DOMAIN PM2_BACKEND_INSTANCES
}

ensure_dirs() {
  mkdir -p "$RELEASES_DIR" "$BACKUPS_DIR" "$LOGS_DIR" "$CONFIGS_DIR" "$TMP_DIR"
}

# ------------------------------------------------------------------------------
# Template rendering — replaces {{KEY}} tokens using current env vars.
# ------------------------------------------------------------------------------
render_template() {
  local src="$1" dst="$2" key val
  cp "$src" "$dst"
  while IFS='=' read -r key val; do
    [[ -z "$key" ]] && continue
    sed -i "s|{{${key}}}|${val//|/\|}|g" "$dst"
  done < <(env | grep -E '^[A-Z0-9_]+=')
  sed -i 's|{{[A-Z0-9_]*}}||g' "$dst"
}

# ------------------------------------------------------------------------------
# Secrets
# ------------------------------------------------------------------------------
gen_password() { openssl rand -base64 24 2>/dev/null | tr -d '/+=' | head -c 32 || true; }

ensure_db_password() {
  # Reads existing password (never regenerates), creates one otherwise.
  if [[ -f "$DB_PASSWORD_FILE" ]]; then
    DB_PASSWORD="$(tr -d '\r\n' < "$DB_PASSWORD_FILE")"
  else
    DB_PASSWORD="$(gen_password)"
    printf '%s\n' "$DB_PASSWORD" > "$DB_PASSWORD_FILE"
    chmod 600 "$DB_PASSWORD_FILE"
    warn "Generated database password -> $DB_PASSWORD_FILE"
    warn "Copy DATABASE_URL into '.env.production' using this password."
  fi
  export DB_PASSWORD
}

# ------------------------------------------------------------------------------
# Fail helpers used by deploy scripts
# ------------------------------------------------------------------------------
run_with_retry() {
  local tries="${1:-3}" n=1
  shift
  until "$@"; do
    if (( n >= tries )); then return 1; fi
    warn "Command failed (attempt $n/$tries), retrying: $*"
    ((n++))
    sleep 3
  done
}

wait_for_port() {
  local host="$1" port="$2" tries="${3:-30}"
  local n=0
  while ! (exec 3<>"/dev/tcp/${host}/${port}") 2>/dev/null; do
    ((n++))
    if (( n >= tries )); then return 1; fi
    sleep 1
  done
  return 0
}

print_success_banner() {
  printf '%s\n' "${C_GREEN}"
  printf '  ╔══════════════════════════════════════════════════════════════╗\n'
  printf '  ║            Vegamart deployment completed                      ║\n'
  printf '  ╚══════════════════════════════════════════════════════════════╝\n'
  printf '%s\n' "${C_RESET}"
}
