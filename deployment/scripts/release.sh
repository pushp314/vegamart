#!/usr/bin/env bash
# ==============================================================================
# scripts/release.sh — release lifecycle: env prep, clone, build, activate,
# rollback. Sourced by deploy.sh / update.sh / rollback.sh.
#   Direct usage:  release.sh --list
# ==============================================================================
set -Eeuo pipefail
# shellcheck disable=SC1091
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/lib.sh" && pwd)/lib.sh"

# ------------------------------------------------------------------------------
# Environment file handling
# ------------------------------------------------------------------------------
require_env_file() {
  if [[ ! -f "$ENV_FILE" ]]; then
    if [[ -f "${DEPLOY_DIR}/.env.production.example" ]]; then
      cp "${DEPLOY_DIR}/.env.production.example" "$ENV_FILE"
      chmod 600 "$ENV_FILE"
    fi
    die "Fill ${ENV_FILE} (or deployment/.env.production) and re-run deploy.sh."
  fi
}

fill_secrets() {
  # Resolves __YOUR_DOMAIN__, __DB_PASSWORD__ and __GENERATE__ tokens.
  require_var DOMAIN "Add 'DOMAIN=your-domain.com' to configs/deploy.env."

  sed -i "s|__YOUR_DOMAIN__|${DOMAIN}|g" "$ENV_FILE"

  if [[ -f "$DB_PASSWORD_FILE" ]]; then
    DB_PASSWORD="$(tr -d '\r\n' < "$DB_PASSWORD_FILE")"
    sed -i "s|__DB_PASSWORD__|${DB_PASSWORD}|g" "$ENV_FILE"
  else
    warn "No generated DB password yet — leaving __DB_PASSWORD__ for you to fill."
  fi

  local key val generated=0
  while IFS='=' read -r key val; do
    [[ "$val" == "__GENERATE__" ]] || continue
    local secret
    secret="$(openssl rand -hex 32)"
    sed -i "s|^${key}=__GENERATE__|${key}=${secret}|" "$ENV_FILE"
    generated=1
  done < <(grep -E '^[A-Z0-9_]+=__GENERATE__$' "$ENV_FILE" || true)
  if (( generated )); then
    info "Generated secure secrets in ${ENV_FILE}"
  fi
}

env_value() {
  # Reads a value out of ENV_FILE. Usage: env_value KEY
  grep -E "^${1}=" "$ENV_FILE" | head -n1 | cut -d'=' -f2- | tr -d '\r'
}

validate_env() {
  local missing=()
  for k in DATABASE_URL JWT_ACCESS_SECRET JWT_REFRESH_SECRET \
           R2_ACCOUNT_ID R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY \
           RAZORPAY_KEY_ID RAZORPAY_KEY_SECRET; do
    local v; v="$(env_value "$k")"
    if [[ -z "$v" || "$v" == __* ]]; then missing+=("$k"); fi
  done
  if (( ${#missing[@]} > 0 )); then
    die "Required values missing/placeholder in ${ENV_FILE}: ${missing[*]}. The backend refuses to boot without R2 + Razorpay credentials in production."
  fi
  info "Environment validated (${#missing[@]} required checks passed)"
}

# ------------------------------------------------------------------------------
# Release creation
# ------------------------------------------------------------------------------
new_release_id() { date +%Y%m%d%H%M%S%N; }

clone_repo() {
  local release_dir="$1"
  require_var GIT_REPO_URL "Add 'GIT_REPO_URL=git@host:user/repo.git' (or https) to configs/deploy.env."
  local branch="${GIT_BRANCH:-main}"

  sub "Cloning ${GIT_REPO_URL} (branch ${branch}, shallow)"
  if [[ "$GIT_REPO_URL" == git@* ]] || [[ "$GIT_REPO_URL" == ssh://* ]]; then
    GIT_SSH_COMMAND="ssh -o StrictHostKeyChecking=accept-new" \
      git clone --depth 1 --single-branch --branch "$branch" "$GIT_REPO_URL" "$release_dir"
  else
    git clone --depth 1 --single-branch --branch "$branch" "$GIT_REPO_URL" "$release_dir"
  fi
  ok "Cloned into ${release_dir}"
}

write_env_files() {
  local release_dir="$1"
  local backend_env="${release_dir}/backend/.env"
  local fe_env="${release_dir}/gali-connect-main/.env.production"

  grep -E '^[A-Z0-9_]+=' "$ENV_FILE" | grep -vE '^VITE_' > "$backend_env"
  grep -E '^VITE_[A-Z0-9_]+=' "$ENV_FILE" > "$fe_env"
  chmod 600 "$backend_env" "$fe_env"
  info "Wrote backend/.env ($(wc -l < "$backend_env") lines) and frontend .env.production ($(wc -l < "$fe_env") lines)"
}

# ------------------------------------------------------------------------------
# Builds
# ------------------------------------------------------------------------------
npm_install_dir() {
  local dir="$1"
  ( cd "$dir" && {
      if [[ -f package-lock.json ]]; then npm ci --no-audit --no-fund --no-progress;
      elif [[ -f bun.lockb || -f bun.lock ]]; then npm install --no-audit --no-fund --no-progress;
      else npm install --no-audit --no-fund --no-progress; fi
    } >/dev/null 2>&1 )
}

build_backend() {
  local release_dir="$1"
  sub "Backend: dependencies"
  npm_install_dir "${release_dir}/backend"
  sub "Backend: prisma generate"
  ( cd "${release_dir}/backend" && ./node_modules/.bin/prisma generate --schema src/prisma/schema.prisma >/dev/null )
  sub "Backend: schema + seed"
  ( cd "${release_dir}/backend" && {
      if [[ -d src/prisma/migrations ]]; then
        ./node_modules/.bin/prisma migrate deploy --schema src/prisma/schema.prisma
      else
        ./node_modules/.bin/prisma db push --schema src/prisma/schema.prisma --skip-generate
      fi
    } >/dev/null )
  sub "Backend: TypeScript build"
  ( cd "${release_dir}/backend" && npm run build >/dev/null )
  [[ -f "${release_dir}/backend/dist/server.js" ]] || die "Backend build did not produce dist/server.js"
  ok "Backend built"
}

build_frontend() {
  local release_dir="$1"
  sub "Frontend: dependencies"
  npm_install_dir "${release_dir}/gali-connect-main"
  sub "Frontend: production build (NITRO_PRESET=node-server)"
  ( cd "${release_dir}/gali-connect-main" && NITRO_PRESET=node-server npm run build >/dev/null )
  if [[ -f "${release_dir}/gali-connect-main/.output/server/index.mjs" ]]; then
    export FRONTEND_MODE="ssr"
  elif [[ -f "${release_dir}/gali-connect-main/dist/index.html" ]]; then
    export FRONTEND_MODE="static"
  else
    die "Frontend build produced no runnable output (.output/server/index.mjs or dist/)."
  fi
  ok "Frontend built (mode=${FRONTEND_MODE})"
}

# ------------------------------------------------------------------------------
# Activation
# ------------------------------------------------------------------------------
list_releases() {
  echo "Releases:"
  for r in "${RELEASES_DIR}"/*; do
    [[ -d "$r" && "$(basename "$r")" != "current" && "$(basename "$r")" != "previous" ]] || continue
    local tag=""
    [[ "$(readlink -f "$CURRENT_LINK" 2>/dev/null)" == "$(readlink -f "$r")" ]] && tag=" <-- current"
    printf '  %s%s\n' "$(basename "$r")" "$tag"
  done
  [[ -L "$CURRENT_LINK" ]] && echo "current -> $(readlink "$CURRENT_LINK")"
}

seed_db() {
  local release_dir="$1"
  sub "Database seed"
  ( cd "${release_dir}/backend" && ./node_modules/.bin/tsx src/prisma/seed.ts >/dev/null )
  ok "Seeded database"
}

activate_release() {
  local release_dir="$1"
  mkdir -p "$(dirname "$CURRENT_LINK")"

  # Track previous release for rollback.
  if [[ -L "$CURRENT_LINK" ]]; then
    local prev
    prev="$(readlink "$CURRENT_LINK" 2>/dev/null || true)"
    [[ -n "$prev" && -d "${RELEASES_DIR}/${prev}" ]] && ln -sfn "${RELEASES_DIR}/${prev}" "${RELEASES_DIR}/previous"
  fi

  ln -sfn "$release_dir" "$CURRENT_LINK"
  ok "Activated: $(basename "$release_dir") → current"

  if command -v pm2 >/dev/null 2>&1; then
    sub "PM2 startOrReload"
    pm2 startOrReload "${CONFIGS_DIR}/ecosystem.config.js" >/dev/null 2>&1 \
      || pm2 startOrReload "${CONFIGS_DIR}/ecosystem.config.js"
    pm2 save >/dev/null 2>&1 || true
    ok "PM2 reloaded"
  fi

  # Re-render nginx (harmless; keeps config canonical after cert changes).
  if command -v nginx >/dev/null 2>&1; then
    "${DEPLOY_DIR}/scripts/nginx-config.sh" >/dev/null 2>&1 || true
  fi
}

wait_ready() {
  sub "Waiting for services to come up"
  local ok=1
  wait_for_port 127.0.0.1 "$API_PORT" 30 || { error "API port ${API_PORT} not listening"; ok=0; }
  wait_for_port 127.0.0.1 "$WEB_PORT" 30 || { error "Web port ${WEB_PORT} not listening"; ok=0; }
  curl -fsS "http://127.0.0.1:${API_PORT}/api/v1/health" >/dev/null 2>&1 || { warn "API health endpoint not responding yet"; }
  if (( ok == 0 )); then
    die "Services failed to start — run ./rollback.sh to restore the previous release."
  fi
  ok "API (${API_PORT}) and Web (${WEB_PORT}) are listening"
}

# ------------------------------------------------------------------------------
# Direct CLI
# ------------------------------------------------------------------------------
if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  load_config
  case "${1:-}" in
    --list) list_releases ;;
    *) echo "Usage: release.sh --list" >&2; exit 2 ;;
  esac
fi
