# Gali Connect — Backend

Production-grade REST API for the **Gali Connect** hyperlocal marketplace (Blinkit / Zepto / Instamart style).
It powers the existing React frontend (`gali-connect-main`), which expects the API at
`http://localhost:8080/api/v1`.

## Stack

| Layer           | Technology                                     |
| --------------- | ---------------------------------------------- |
| Runtime         | Node.js LTS (>= 20)                            |
| Language        | TypeScript (strict)                            |
| Framework       | Express.js 4                                   |
| Database        | PostgreSQL                                     |
| ORM             | Prisma                                          |
| Auth            | JWT access + refresh tokens, HTTP-only cookies, RBAC |
| Password        | bcrypt                                          |
| Validation      | Zod                                             |
| Logging         | Winston + Morgan                                |
| Docs            | Swagger (OpenAPI 3)                             |
| Tests           | Jest + Supertest                                |
| Storage         | Cloudflare R2 (later phase)                     |
| Payments        | Razorpay (later phase)                          |
| Emails          | Nodemailer (later phase)                        |

## Folder Structure

```
backend/
├── src/
│   ├── config/          # env (Zod), logger (Winston), morgan, swagger
│   ├── database/        # Prisma client singleton + connection manager
│   ├── middlewares/     # request-id, validate (Zod), error-handler, auth (later)
│   ├── controllers/     # route handlers (request in/out)
│   ├── services/        # business logic
│   ├── repositories/    # data access layer (Prisma queries)
│   ├── routes/v1/       # versioned route modules
│   ├── validators/      # Zod schemas
│   ├── models/          # plain domain models
│   ├── types/           # shared TypeScript types
│   ├── utils/           # ApiError, ApiResponse, asyncHandler, pagination
│   ├── constants/       # roles, permissions, app constants
│   ├── events/          # in-app event bus
│   ├── sockets/         # Socket.IO (live tracking)
│   ├── jobs/            # background jobs (queues, schedulers)
│   ├── emails/          # Nodemailer templates
│   ├── storage/         # Cloudflare R2
│   ├── payments/        # Razorpay
│   ├── notifications/   # email / sms / push / in-app
│   ├── prisma/          # schema.prisma + seed.ts
│   ├── docs/            # OpenAPI docs
│   ├── tests/           # unit tests
│   ├── logs/            # runtime log files (gitignored)
│   ├── public/          # static assets / uploads
│   ├── app.ts           # Express application
│   └── server.ts        # entry point + graceful shutdown
├── prisma/migrations/   # generated SQL migrations
├── tests/               # integration tests
├── docs/                # deployment guides (nginx, backup, etc.)
├── ecosystem.config.js  # PM2
└── package.json
```

## Getting Started

### 1. Prerequisites

- **Node.js >= 20** (LTS)
- **PostgreSQL >= 14** (see install notes below)
- npm

### 2. Install PostgreSQL

**Windows** — download the installer from https://www.postgresql.org/download/windows/
(EDB installer). During install:
- Set a password for the `postgres` user (e.g. `postgres` for local dev).
- Keep the default port **5432**.
- Add `psql` to PATH.

**Ubuntu / Debian:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib -y
sudo systemctl enable --now postgresql
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';"
```

**macOS:**
```bash
brew install postgresql@16
brew services start postgresql@16
```

Create the database:

```bash
psql -U postgres -h localhost -c "CREATE DATABASE gali_connect;"
```

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set at minimum `DATABASE_URL` (defaults target the database created above).

### 4. Install dependencies

```bash
npm install
```

### 5. Run migrations & seed

```bash
npm run prisma:generate   # generate the Prisma client
npm run prisma:migrate    # apply migrations (creates all tables)
npm run prisma:seed       # roles, permissions + default super admin
```

Default super admin (from `npm run prisma:seed`):

```
email:    admin@galiconnect.local
password: Admin@12345
```

> ⚠ Change this password immediately after first login. Override with
> `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` if desired.

### 6. Run the server

```bash
npm run dev        # watch mode (tsx watch)
npm run build      # production compile
npm run start      # run compiled dist/server.js
```

Verify:

```bash
curl http://localhost:8080/api/v1/health
curl http://localhost:8080/api/v1/health/db
```

Open the API docs: http://localhost:8080/api/v1/docs

## Available Scripts

| Script                 | Description                                   |
| ---------------------- | --------------------------------------------- |
| `npm run dev`          | Start with hot reload (tsx watch)             |
| `npm run dev:no-watch` | Start without watch                           |
| `npm run build`        | Type-check + compile to `dist/`               |
| `npm run start`        | Run compiled output                           |
| `npm run typecheck`    | `tsc --noEmit`                                |
| `npm run lint`         | ESLint over `src`                             |
| `npm test`             | Run Jest suites                               |
| `npm run prisma:generate` | Generate Prisma client                     |
| `npm run prisma:migrate`  | Create/apply dev migrations                 |
| `npm run prisma:deploy`   | Apply migrations in production              |
| `npm run prisma:studio`   | Open Prisma Studio                          |
| `npm run prisma:seed`     | Seed roles/permissions/admin                |
| `npm run db:push`         | Push schema without migrations (dev only)   |

## Environment Variables

Every variable is validated with **Zod** at startup (`src/config/env.ts`).
The app refuses to boot with invalid/missing values. Required in production:
- `DATABASE_URL`
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` (32+ chars, not the defaults)
- `R2_*` and `RAZORPAY_*` (enforced in `production`)

See `.env.example` for the full annotated list.

## API Conventions

- Base path: `/api/v1`
- Every response is a consistent JSON envelope:

```json
// Success
{ "success": true, "message": "ok", "data": { }, "pagination": { } }

// Error
{ "success": false, "error": { "code": "NOT_FOUND", "message": "...", "details": {} }, "requestId": "..." }
```

- Every request carries `X-Request-ID` (echoed back) for log correlation.
- Pagination uses `?page=` & `?per_page=`; responses include a `pagination` object.
- Errors: `400` invalid JSON / `401` auth / `403` forbidden / `404` missing /
  `409` conflicts / `422` validation / `429` rate-limit / `5xx` server.

## Testing

```bash
npm test
```

Unit tests cover the validation middleware; integration tests cover the app
(health, 404, malformed JSON, security headers, docs). Test suites for auth,
payments and uploads are added in later phases.

## Deployment

### PM2

```bash
npm install -g pm2
npm run build
pm2 start ecosystem.config.js   # cluster mode, max instances
pm2 save
pm2 startup
```

### Nginx + HTTPS

An annotated reverse-proxy config lives at `docs/nginx.conf`. Essentials:

```bash
sudo certbot certonly --nginx -d your-domain.com
# symlink docs/nginx.conf into sites-enabled, adjust domain & cert paths
sudo nginx -t && sudo nginx -s reload
```

HTTPS terminates at Nginx; the app sets `trust proxy = 1` so
`req.ip`/rate-limit keys resolve the real client IP.

### Database backup strategy

**Automated nightly dumps** (cron on the DB host):

```bash
# /etc/cron.d/gali-backup
0 2 * * *  pg_dump -U postgres -Fc gali_connect | gzip > /var/backups/gali/gali_$(date +\%F).dump.gz
```

**Daily binary backup + retention:**
```bash
BACKUP_DIR=/var/backups/gali
mkdir -p $BACKUP_DIR
find $BACKUP_DIR -name "*.dump.gz" -mtime +14 -delete
```

**Restore:**
```bash
gunzip -c /var/backups/gali/gali_YYYY-MM-DD.dump.gz | pg_restore -U postgres -d gali_connect --clean --if-exists
```

**WAL archiving (point-in-time recovery)** — enable `wal_level=replica`,
`archive_mode=on`, and ship archives to object storage. See `docs/deployment` for
the full strategy document (added with the backup guide).

## Cloudflare R2 & Razorpay

Used in later phases. R2 keys (`R2_*`) and Razorpay keys (`RAZORPAY_*`) are
already declared in `.env.example`; leaving them blank is fine until those
modules ship.

## Security Baseline

- Helmet security headers + CSP
- CORS allow-list (client origins only)
- Rate limiting (global + auth-specific)
- Strict Zod input validation on every route
- Prisma parameterised queries (SQL-injection safe)
- bcrypt password hashing (cost 12)
- JWT access/refresh split with rotation and device sessions
- HTTP-only cookies for refresh tokens
- Request IDs + structured audit logging
- Idempotency keys for payments

## Roadmap by Phase

- **Phase 1 (done):** scaffolding, env validation, logging, Prisma schema +
  migrations + seed, Express app, health checks, error handling, Zod validation,
  Swagger, tests, PM2/nginx/docs.
- **Phase 2:** complete database design polishing, repositories, services and
  the full REST surface (auth, users, vendors, products, carts, orders, delivery,
  admin, payments, storage, notifications, sockets).
