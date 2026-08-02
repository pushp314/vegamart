#!/usr/bin/env bash
# ==============================================================================
# healthcheck.sh — runtime health probe. Prints PASS/FAIL per subsystem.
#   ./healthcheck.sh            full report
#   ./healthcheck.sh --quiet    cron mode: only failures, exit 0/1
# Checks: CPU, memory, disk, Node, PM2, Nginx, PostgreSQL, SSL, ports, app health.
# ==============================================================================
set -Eeuo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/scripts" && pwd)/lib.sh"

load_config

QUIET=0
[[ "${1:-}" == "--quiet" ]] && QUIET=1

FAILURES=0
declare -a REPORT=()

report() { # report <PASS|FAIL> <check> <detail>
  local status="$1" check="$2" detail="${3:-}"
  if [[ "$status" == "PASS" ]]; then
    REPORT+=("PASS  ${check}  ${detail}")
    (( QUIET )) || info "✔ ${check} ${detail}"
  else
    FAILURES=$((FAILURES + 1))
    REPORT+=("FAIL  ${check}  ${detail}")
    (( QUIET )) || error "✘ ${check} ${detail}"
  fi
}

step "Health check $(date '+%Y-%m-%d %H:%M:%S')"

# --- CPU ---------------------------------------------------------------------
load1="$(awk '{print $1}' /proc/loadavg)"
ncpu="$(nproc)"
report "PASS" "CPU load" "load1=${load1}/ncpu=${ncpu}"

# --- Memory ------------------------------------------------------------------
mem_free_mb="$(awk '/MemAvailable/{print int($2/1024)}' /proc/meminfo)"
mem_total_mb="$(awk '/MemTotal/{print int($2/1024)}' /proc/meminfo)"
mem_pct="$(( mem_total_mb ? (mem_total_mb - mem_free_mb) * 100 / mem_total_mb : 0 ))"
if (( mem_pct < 95 )); then
  report "PASS" "Memory" "${mem_pct}% used (${mem_free_mb} MB free)"
else
  report "FAIL" "Memory" "${mem_pct}% used"
fi

# --- Disk --------------------------------------------------------------------
disk_usage="$(df -h / | awk 'NR==2{print $5}' | tr -d '%')"
if (( disk_usage < 90 )); then
  report "PASS" "Disk /" "${disk_usage}% used"
else
  report "FAIL" "Disk /" "${disk_usage}% used (≥90%)"
fi

# --- Node --------------------------------------------------------------------
if command -v node >/dev/null 2>&1; then
  report "PASS" "Node.js" "$(node -v)"
else
  report "FAIL" "Node.js" "not installed"
fi

# --- PM2 ---------------------------------------------------------------------
if command -v pm2 >/dev/null 2>&1; then
  for app in vegamart-api vegamart-web; do
    st="$(pm2 jlist 2>/dev/null | python3 -c "import sys,json;[print(a['name'],a['pm2_env']['status']) for a in json.load(sys.stdin) if a['name']=='${app}']" 2>/dev/null || true)"
    if echo "$st" | grep -q "online"; then
      report "PASS" "PM2 ${app}" "online"
    else
      report "FAIL" "PM2 ${app}" "not online (${st:-missing})"
    fi
  done
else
  report "FAIL" "PM2" "not installed"
fi

# --- Nginx -------------------------------------------------------------------
if systemctl is-active --quiet nginx 2>/dev/null; then
  report "PASS" "Nginx" "active"
else
  report "FAIL" "Nginx" "inactive"
fi

# --- PostgreSQL ---------------------------------------------------------------
if command -v pg_isready >/dev/null 2>&1 && pg_isready -h 127.0.0.1 -p 5432 >/dev/null 2>&1; then
  report "PASS" "PostgreSQL" "accepting connections (5432)"
elif command -v pg_isready >/dev/null 2>&1 && pg_isready -h 127.0.0.1 -p 6432 >/dev/null 2>&1; then
  report "PASS" "PostgreSQL (PgBouncer)" "accepting connections (6432)"
else
  report "FAIL" "PostgreSQL" "not accepting connections"
fi

# --- Ports -------------------------------------------------------------------
for port in "${API_PORT:-8080}" "${WEB_PORT:-3000}"; do
  if (exec 3<>"/dev/tcp/127.0.0.1/${port}") 2>/dev/null; then
    report "PASS" "Port ${port}" "listening"
    exec 3>&- 2>/dev/null || true
  else
    report "FAIL" "Port ${port}" "not listening"
  fi
done

# --- App health ---------------------------------------------------------------
if curl -fsS "http://127.0.0.1:${API_PORT}/api/v1/health" >/dev/null 2>&1; then
  report "PASS" "API health" "http://127.0.0.1:${API_PORT}/api/v1/health"
else
  report "FAIL" "API health" "endpoint not responding"
fi
if curl -fsS "http://127.0.0.1:${WEB_PORT}/" >/dev/null 2>&1; then
  report "PASS" "Web server" "http://127.0.0.1:${WEB_PORT}/"
else
  report "FAIL" "Web server" "not responding"
fi

# --- SSL ----------------------------------------------------------------------
if [[ -n "${DOMAIN:-}" && -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]]; then
  CERT="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"
  days="$(python3 - "$CERT" <<'PYEOF' 2>/dev/null || echo ""
import sys, subprocess, datetime
out = subprocess.check_output(["openssl", "x509", "-enddate", "-noout", "-in", sys.argv[1]]).decode()
exp = datetime.datetime.strptime(out.split("=", 1)[1].strip(), "%b %d %H:%M:%S %Y %Z")
print((exp - datetime.datetime.now(datetime.timezone.utc)).days)
PYEOF
)"
  if [[ -n "$days" ]] && (( days > 7 )); then
    report "PASS" "SSL ${DOMAIN}" "expires in ~${days} days"
  else
    report "FAIL" "SSL ${DOMAIN}" "expires soon or unreadable"
  fi
else
  report "PASS" "SSL" "no certificate configured (expected before setup-ssl.sh)"
fi

# --- Summary -------------------------------------------------------------------
step "Health summary"
for line in "${REPORT[@]}"; do
  if (( QUIET )) && [[ "$line" == PASS* ]]; then continue; fi
  echo "$line" | tee -a "$LOG_FILE"
done

if (( FAILURES == 0 )); then
  ok "All subsystems healthy"
  exit 0
else
  error "${FAILURES} check(s) failed — see ${LOG_FILE}"
  exit 1
fi
