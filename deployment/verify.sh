#!/usr/bin/env bash
# ==============================================================================
# verify.sh — post-deployment verification. Prints a deployment summary table
# and exits non-zero if any critical check fails.
# ==============================================================================
set -Eeuo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/scripts" && pwd)/lib.sh"

require_root
load_config

PASS=0; WARN=0; FAIL=0
declare -a SUMMARY=()

check() { # check <result> <name> <detail>
  local r="$1" n="$2" d="${3:-}"
  case "$r" in
    PASS) PASS=$((PASS+1)) ;;
    WARN) WARN=$((WARN+1)) ;;
    FAIL) FAIL=$((FAIL+1)) ;;
  esac
  SUMMARY+=("$r|$n|$d")
}

step "Deployment verification $(date '+%Y-%m-%d %H:%M:%S')"

# --- Toolchain ---------------------------------------------------------------
command -v git >/dev/null 2>&1 && check PASS "git" "$(git --version)" || check FAIL "git" "missing"
command -v node >/dev/null 2>&1 && check PASS "node" "$(node -v)" || check FAIL "node" "missing"
command -v npm >/dev/null 2>&1 && check PASS "npm" "$(npm -v)" || check FAIL "npm" "missing"
command -v pm2 >/dev/null 2>&1 && check PASS "pm2" "$(pm2 -v)" || check FAIL "pm2" "missing"
systemctl is-active --quiet nginx 2>/dev/null && check PASS "nginx" "active" || check FAIL "nginx" "inactive"
command -v psql >/dev/null 2>&1 && check PASS "postgres" "$(psql --version | head -n1)" || check FAIL "postgres" "missing"

# --- Database connection --------------------------------------------------------
DB_URL="$(grep -E '^DATABASE_URL=' "$ENV_FILE" 2>/dev/null | head -n1 | cut -d'=' -f2- | tr -d '\r' || true)"
if [[ -n "$DB_URL" ]]; then
  if python3 - "$DB_URL" <<'PYEOF' >/dev/null 2>&1
import sys, subprocess, urllib.parse
u = urllib.parse.urlparse(sys.argv[1])
host, port, user, pw = u.hostname or "127.0.0.1", u.port or 5432, urllib.parse.unquote(u.username or ""), urllib.parse.unquote(u.password or "")
import os
env = {**os.environ, "PGPASSWORD": pw}
r = subprocess.run(["psql", "-h", host, "-p", str(port), "-U", user, "-d", u.path.lstrip("/").split("/")[0], "-tAc", "SELECT 1"], env=env, capture_output=True)
sys.exit(0 if r.stdout.strip() == b"1" else 1)
PYEOF
  then
    check PASS "database connection" "SELECT 1 OK"
  else
    check FAIL "database connection" "cannot connect via psql"
  fi
else
  check FAIL "database connection" "DATABASE_URL missing from ${ENV_FILE}"
fi

# --- Application health ----------------------------------------------------------
if curl -fsS "http://127.0.0.1:${API_PORT:-8080}/api/v1/health" >/dev/null 2>&1; then
  check PASS "backend /api/v1/health" "200 OK"
else
  check FAIL "backend /api/v1/health" "unreachable"
fi
if curl -fsS "http://127.0.0.1:${WEB_PORT:-3000}/" >/dev/null 2>&1; then
  check PASS "frontend" "HTTP 200 on :${WEB_PORT:-3000}"
else
  check FAIL "frontend" "unreachable"
fi

# --- SSL ------------------------------------------------------------------------
if [[ -n "${DOMAIN:-}" ]]; then
  if [[ -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]]; then
    check PASS "ssl ${DOMAIN}" "$(openssl x509 -enddate -noout -in "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" | cut -d= -f2)"
  else
    check WARN "ssl ${DOMAIN}" "no cert yet — run setup-ssl.sh after DNS points here"
  fi
fi
if [[ -n "${API_DOMAIN:-}" ]]; then
  if getent ahostsv4 "$API_DOMAIN" >/dev/null 2>&1; then
    check PASS "domain ${API_DOMAIN}" "resolves ($(getent ahostsv4 "$API_DOMAIN" | awk 'NR==1{print $1}'))"
  else
    check FAIL "domain ${API_DOMAIN}" "does not resolve — add an A record for ${API_DOMAIN}"
  fi
  if [[ -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]]; then
    check PASS "ssl ${API_DOMAIN}" "covered by ${DOMAIN} cert"
  else
    check WARN "ssl ${API_DOMAIN}" "no cert yet"
  fi
fi

# --- Security --------------------------------------------------------------------
if ufw status 2>/dev/null | grep -q "Status: active"; then
  check PASS "firewall (ufw)" "active"
else
  check FAIL "firewall (ufw)" "inactive — run setup-firewall.sh"
fi
if systemctl is-active --quiet fail2ban 2>/dev/null; then
  check PASS "fail2ban" "active"
else
  check FAIL "fail2ban" "inactive"
fi
if crontab -l 2>/dev/null | grep -qF "VEGAMART DEPLOYMENT CRON"; then
  check PASS "cron" "managed block present"
else
  check FAIL "cron" "managed block missing — run setup-cron.sh"
fi

# --- Environment -------------------------------------------------------------------
[[ -f "$ENV_FILE" ]] && check PASS "env file" "$ENV_FILE" || check FAIL "env file" "missing"
for k in DATABASE_URL JWT_ACCESS_SECRET JWT_REFRESH_SECRET R2_ACCOUNT_ID RAZORPAY_KEY_ID; do
  v="$(grep -E "^${k}=" "$ENV_FILE" 2>/dev/null | head -n1 | cut -d'=' -f2- | tr -d '\r' || true)"
  if [[ -n "$v" && "$v" != __* ]]; then
    check PASS "env ${k}" "set"
  else
    check FAIL "env ${k}" "missing or placeholder"
  fi
done

# --- Resources ---------------------------------------------------------------------
disk="$(df -h / | awk 'NR==2{print $5}' | tr -d '%')"
(( disk < 90 )) && check PASS "disk /" "${disk}% used" || check FAIL "disk /" "${disk}% used"
mem_free="$(awk '/MemAvailable/{print int($2/1024)}' /proc/meminfo)"
(( mem_free > 100 )) && check PASS "memory" "${mem_free} MB free" || check FAIL "memory" "${mem_free} MB free"

# --- Ports + domain ----------------------------------------------------------------
for port in "${API_PORT:-8080}" "${WEB_PORT:-3000}"; do
  (exec 3<>"/dev/tcp/127.0.0.1/${port}") 2>/dev/null && { check PASS "port ${port}" "listening"; exec 3>&- 2>/dev/null || true; } \
    || check FAIL "port ${port}" "not listening"
done
if [[ -n "${DOMAIN:-}" ]]; then
  if getent ahostsv4 "$DOMAIN" >/dev/null 2>&1; then
    check PASS "domain ${DOMAIN}" "resolves ($(getent ahostsv4 "$DOMAIN" | awk 'NR==1{print $1}'))"
  else
    check FAIL "domain ${DOMAIN}" "does not resolve"
  fi
fi

# --- Summary table -----------------------------------------------------------------
step "Deployment summary"
printf '%-6s %-28s %s\n' "RESULT" "CHECK" "DETAIL" | tee -a "$LOG_FILE"
printf '%s\n' "------------------------------------------------------------" | tee -a "$LOG_FILE"
for line in "${SUMMARY[@]}"; do
  IFS='|' read -r r n d <<< "$line"
  case "$r" in
    PASS) printf '%-6s %-28s %s\n' "${C_GREEN}PASS${C_RESET}" "$n" "$d" | tee -a "$LOG_FILE" ;;
    WARN) printf '%-6s %-28s %s\n' "${C_YELLOW}WARN${C_RESET}" "$n" "$d" | tee -a "$LOG_FILE" ;;
    FAIL) printf '%-6s %-28s %s\n' "${C_RED}FAIL${C_RESET}" "$n" "$d" | tee -a "$LOG_FILE" ;;
  esac
done
printf '\n%s\n' "Result: ${C_GREEN}${PASS} PASS${C_RESET}, ${C_YELLOW}${WARN} WARN${C_RESET}, ${C_RED}${FAIL} FAIL${C_RESET}" | tee -a "$LOG_FILE"

if (( FAIL == 0 )); then
  ok "Verification passed"
  exit 0
else
  error "Verification found ${FAIL} failing check(s)"
  exit 1
fi
