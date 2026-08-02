#!/usr/bin/env bash
# ==============================================================================
# setup-postgres.sh — installs PostgreSQL, creates DB + user with a generated
# password, hardens listener/auth, enables the service, and (optionally)
# configures PgBouncer connection pooling. Idempotent.
# ==============================================================================
set -Eeuo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/scripts" && pwd)/lib.sh"

require_root
load_config
ensure_dirs

step "PostgreSQL setup"

# ------------------------------------------------------------------------------
# 1. Install
# ------------------------------------------------------------------------------
if ! command -v psql >/dev/null 2>&1; then
  sub "Installing PostgreSQL (Ubuntu 24.04 ships PG16)"
  DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    postgresql postgresql-contrib >/dev/null
  ok "PostgreSQL installed"
else
  info "PostgreSQL already installed: $(psql --version)"
fi

# Service (cluster may be named e.g. 16/main)
PG_CLUSTER="$(pg_lsclusters -h 2>/dev/null | awk 'NR>1{print $1"/"$2; exit}')"
systemctl enable postgresql >/dev/null 2>&1 || true
systemctl start postgresql >/dev/null 2>&1 || true

# ------------------------------------------------------------------------------
# 2. Secure password (idempotent — never regenerates an existing one)
# ------------------------------------------------------------------------------
ensure_db_password

# ------------------------------------------------------------------------------
# 3. Hardened config: listen on loopback only + SCRAM auth
# ------------------------------------------------------------------------------
PGCONF="/etc/postgresql/${PG_CLUSTER}/postgresql.conf"
PGHBA="/etc/postgresql/${PG_CLUSTER}/pg_hba.conf"

if ! grep -qE "^[[:space:]]*listen_addresses" "$PGCONF"; then
  sub "Binding PostgreSQL to 127.0.0.1 only"
  cp "$PGCONF" "${PGCONF}.bak"
  sed -i "s|^#listen_addresses.*|listen_addresses = '127.0.0.1'|" "$PGCONF"
  grep -qE "^[[:space:]]*listen_addresses" "$PGCONF" || echo "listen_addresses = '127.0.0.1'" >> "$PGCONF"
fi

# Ensure scram-sha-256 for local TCP (replaces trust/ident where present)
cp "$PGHBA" "${PGHBA}.bak" 2>/dev/null || true
sed -i "s|^\(host[[:space:]]*all[[:space:]]*all[[:space:]]*127.0.0.1/32[[:space:]]*\).*|\1scram-sha-256|" "$PGHBA"
grep -qE "^host[[:space:]]+all[[:space:]]+all[[:space:]]+127.0.0.1/32" "$PGHBA" || \
  echo "host all all 127.0.0.1/32 scram-sha-256" >> "$PGHBA"
sed -i "s|^\(host[[:space:]]*all[[:space:]]*all[[:space:]]*::1/128[[:space:]]*\).*|\1scram-sha-256|" "$PGHBA"
grep -qE "^host[[:space:]]+all[[:space:]]+all[[:space:]]+::1/128" "$PGHBA" || \
  echo "host all all ::1/128 scram-sha-256" >> "$PGHBA"

systemctl restart postgresql >/dev/null 2>&1

# ------------------------------------------------------------------------------
# 4. Create role + database (idempotent)
# ------------------------------------------------------------------------------
run_as_postgres() { su - postgres -c "psql -v ON_ERROR_STOP=1 -tAc \"$1\""; }

if [[ "$(run_as_postgres "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'")" != "1" ]]; then
  sub "Creating database role '${DB_USER}'"
  run_as_postgres "CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASSWORD}'"
  ok "Role created"
else
  info "Role '${DB_USER}' already exists"
  run_as_postgres "ALTER ROLE ${DB_USER} WITH LOGIN PASSWORD '${DB_PASSWORD}'"
  info "Password synced to generated value"
fi

if [[ "$(run_as_postgres "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'")" != "1" ]]; then
  sub "Creating database '${DB_NAME}'"
  run_as_postgres "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER}"
  ok "Database created"
else
  info "Database '${DB_NAME}' already exists"
fi

# ------------------------------------------------------------------------------
# 5. Connection pooling (optional PgBouncer)
# ------------------------------------------------------------------------------
if [[ "$(parse_bool "${ENABLE_PGBOUNCER:-no}")" == "1" ]]; then
  apt_ensure pgbouncer
  PGB_CONF="/etc/pgbouncer/pgbouncer.ini"
  cp "$PGB_CONF" "${PGB_CONF}.bak" 2>/dev/null || true
  cat > "$PGB_CONF" <<EOF
[databases]
${DB_NAME} = host=127.0.0.1 port=5432 dbname=${DB_NAME}

[pgbouncer]
listen_addr = 127.0.0.1
listen_port = 6432
auth_type = plain
auth_file = /etc/pgbouncer/userlist.txt
pool_mode = transaction
max_client_conn = 200
default_pool_size = 20
min_pool_size = 5
reserve_pool_size = 5
server_lifetime = 3600
logfile = /var/log/postgresql/pgbouncer.log
pidfile = /var/run/postgresql/pgbouncer.pid
admin_users = ${DB_USER}
EOF
  printf '"%s" "%s"\n' "$DB_USER" "$DB_PASSWORD" > /etc/pgbouncer/userlist.txt
  chown postgres:postgres /etc/pgbouncer/pgbouncer.ini /etc/pgbouncer/userlist.txt
  chmod 640 /etc/pgbouncer/pgbouncer.ini /etc/pgbouncer/userlist.txt
  systemctl enable pgbouncer >/dev/null 2>&1
  systemctl restart pgbouncer >/dev/null 2>&1
  ok "PgBouncer listening on 127.0.0.1:6432 (transaction pooling)"
fi

# ------------------------------------------------------------------------------
# 6. Schema + seed — only if a deployed release exists on disk
# ------------------------------------------------------------------------------
if [[ -x "${CURRENT_LINK}/backend/node_modules/.bin/prisma" ]]; then
  sub "Applying database schema + seed for current release"
  (
    cd "${CURRENT_LINK}/backend"
    if [[ -d "src/prisma/migrations" ]]; then
      ./node_modules/.bin/prisma migrate deploy --schema src/prisma/schema.prisma
    else
      ./node_modules/.bin/prisma db push --schema src/prisma/schema.prisma --skip-generate
    fi
    ./node_modules/.bin/prisma generate --schema src/prisma/schema.prisma
    ./node_modules/.bin/tsx src/prisma/seed.ts
  )
  ok "Schema + seed applied"
else
  warn "No deployed release found yet — schema/seed will run during the first deploy."
fi

# ------------------------------------------------------------------------------
# 7. Connection string for .env.production
# ------------------------------------------------------------------------------
PGPORT="${ENABLE_PGBOUNCER:+6432}"; PGPORT="${PGPORT:-5432}"
step "PostgreSQL ready"
echo "  DATABASE_URL=postgresql://${DB_USER}:<password>@127.0.0.1:${PGPORT}/${DB_NAME}?schema=public"
echo "  (password stored in ${DB_PASSWORD_FILE})"
echo "  Copy this line into deployment/.env.production → DATABASE_URL"
