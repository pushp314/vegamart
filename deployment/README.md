# Vegamart — Production Deployment Toolkit

Fully automated, idempotent deployment for a **fresh Hostinger Ubuntu 24.04 VPS**.

**Architecture**

```
Internet → Nginx (80/443, TLS, gzip, rate-limit, security headers)
                ├── /api/*            → PM2 vegamart-api   (Express, port 8080, cluster)
                └── /*                → PM2 vegamart-web   (TanStack Start SSR, port 3000)
                                          └── PostgreSQL (localhost:5432, optional PgBouncer:6432)
```

**Your only manual steps**

1. Create the VPS (Ubuntu 24.04).
2. Point your domain's DNS A/AAAA records at the VPS IP.
3. Fill `deployment/.env.production` (secrets are generated for you where marked).
4. Provide Cloudflare R2 credentials.
5. Provide Razorpay credentials.
6. Provide SMTP credentials.

Everything else is automated.

---

## Prerequisites

- A Hostinger VPS with Ubuntu 24.04, reachable over SSH as `root`.
- A domain name whose DNS you control (for SSL).
- Git repository containing the project (`backend/` + `gali-connect-main/`), reachable
  from the VPS over HTTPS or SSH.

### Repository layout assumption

The deployment scripts expect the repository root to contain:

```
<repo>/
├── backend/            # Node/Express API (package.json → dist/server.js)
├── gali-connect-main/  # React/TanStack Start frontend (vite build → .output/)
└── deployment/         # THIS toolkit (track it in the repo)
```

---

## DNS configuration

| Type | Name   | Value      |
|------|--------|------------|
| A    | @      | <VPS IP>   |
| A    | www    | <VPS IP>   |

Wait for propagation (`dig +short yourdomain.com`) before running `setup-ssl.sh`,
which refuses to run while DNS doesn't resolve.

### Cloudflare

If the domain is behind Cloudflare:

- Set the DNS record to **DNS only (grey cloud)** while obtaining the Let's Encrypt
  certificate, then switch to Proxied (orange cloud) afterwards.
- Under **SSL/TLS → Edge Certificates** set mode to **Full (strict)**.

## Cloudflare R2

1. Create a bucket in R2 (e.g. `vegamart-production`).
2. In **R2 → Manage R2 API Tokens**, create a token with **Object Read & Write** on
   that bucket.
3. Fill in `.env.production`:

```env
R2_ACCOUNT_ID=<your R2 account id>
R2_ACCESS_KEY_ID=<token access key>
R2_SECRET_ACCESS_KEY=<token secret>
R2_BUCKET_NAME=vegamart-production
R2_PUBLIC_URL=https://pub-xxxx.r2.dev
```

R2 credentials are **required** — the backend refuses to boot in production without them.

## Razorpay

1. Create a test or live key pair at https://dashboard.razorpay.com.
2. Fill in `.env.production`:

```env
RAZORPAY_KEY_ID=rzp_test_xxxx
RAZORPAY_KEY_SECRET=xxxx
RAZORPAY_WEBHOOK_SECRET=<generated automatically if left as __GENERATE__>
VITE_RAZORPAY_KEY_ID=rzp_test_xxxx     # must match RAZORPAY_KEY_ID
```

## SMTP

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASSWORD=xxxx
SMTP_FROM=Vegamart <no-reply@yourdomain.com>
```

If `SMTP_HOST` is left empty, no mail is sent and OTPs are logged to the backend
console (dev/test convenience).

---

## Deployment steps

### 1. Provision the VPS

```bash
sudo bash /path/to/deployment/install.sh
```

Runs: OS update/upgrade, full package set, Node.js LTS + npm + PM2, PostgreSQL
(db + user + generated password), Nginx, UFW, Fail2Ban, logrotate, monitoring,
cron, swap, SSH hardening. Installs the toolkit itself at `/opt/vegamart/deploy`.

After install, copy your repo to the server **or** just run the toolkit from a
clone. The toolkit writes everything under `/opt/vegamart`:

```
/opt/vegamart/
├── deploy/                  # the toolkit
├── releases/<id>/           # versioned releases
├── releases/current         # symlink → active release
├── releases/previous        # symlink → rollback target
├── backups/                 # timestamped DB dumps
├── logs/                    # app + toolkit logs
├── configs/                 # generated PM2 ecosystem
└── .env.production          # single source of truth for app env
```

### 2. Fill configuration (the manual part)

```bash
nano /opt/vegamart/.env.production                 # R2, Razorpay, SMTP, DB password
nano /opt/vegamart/deploy/configs/deploy.env       # GIT_REPO_URL, DOMAIN, ADMIN_EMAIL
```

`deploy.env` essentials:

```env
GIT_REPO_URL=https://github.com/pushp314/vegamart.git   # or git@github.com:you/vegamart.git
GIT_BRANCH=main
DOMAIN=shop.example.com
ADMIN_EMAIL=you@example.com
```

### 3. First deploy

```bash
cd /opt/vegamart/deploy
./deploy.sh
```

What happens automatically:

1. Validates `.env.production` (fills `__GENERATE__` JWT/webhook secrets).
2. Clones the repo into a new release, installs dependencies.
3. Runs Prisma: `generate` → `db push` (or `migrate deploy` if migrations exist) → seed.
4. Builds the backend (`tsc`) and frontend (`NITRO_PRESET=node-server vite build`).
5. Activates the release (symlink), reloads PM2 (cluster API + SSR web).
6. Renders Nginx config, obtains the Let's Encrypt certificate (requires DNS to point here).
7. Enables UFW, Fail2Ban, logrotate, monitoring, cron.
8. Runs `verify.sh` and prints a success report.

> `prisma db push` is used because this repo has no committed migration files.
> If you later add a `src/prisma/migrations` directory, `migrate deploy` is used instead.

### 4. Deploy new versions

```bash
./update.sh            # backups DB → new release → health check → auto-rollback on failure
./update.sh --seed     # also re-run the database seed
```

### 5. Roll back

```bash
./rollback.sh          # interactive
./rollback.sh -y       # revert to previous release
./rollback.sh <id>     # revert to a specific release
./rollback.sh <id> --db backups/vegamart-<ts>.dump.gz   # also restore a DB dump
```

### 6. Verify / health

```bash
./verify.sh            # post-deploy summary table
./healthcheck.sh       # runtime PASS/FAIL (CPU, mem, disk, node, pm2, nginx, pg, ssl, ports, app)
./healthcheck.sh --quiet
```

---

## Backup & restore

```bash
./backup.sh            # manual DB dump (custom format, gzip, timestamped)
./backup.sh --all      # also bundle .env.production + credentials + configs
./restore.sh backups/vegamart-20260101_030000.dump.gz
```

- Automatic: daily 03:00 via cron (`setup-cron.sh`).
- Retention: 30 days (`RETENTION_BACKUP_DAYS`, enforced by `cleanup.sh`).
- `--all` bundles are sensitive — store them offline, never in git.

---

## Monitoring & operations

- Health check cron every 5 minutes → `/opt/vegamart/logs/healthcheck.log` (failures only).
- Log rotation: 30 days, compressed (`setup-logrotate.sh` + `pm2-logrotate`).
- Certificate auto-renewal: `certbot.timer` + a weekly cron fallback.
- Releases kept: 5 (`RELEASE_KEEP`).

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| `deploy.sh` aborts "Required values missing" | Fill R2 + Razorpay + DATABASE_URL in `.env.production` |
| SSL step fails "DNS does not resolve" | Point A record at the VPS, wait, re-run `./setup-ssl.sh` |
| Backend 503 `DATABASE_UNAVAILABLE` | PostgreSQL down — `systemctl status postgresql`; check `DATABASE_URL` password against `generated-db-password.txt` |
| Frontend shows stale content | `./update.sh` after `git push`; hard refresh (assets are cache-busted by content hash) |
| `npm ci` fails | Confirm `package-lock.json` is committed in the repo |
| PM2 apps restart-looping | `pm2 logs vegamart-api --lines 100` and `vegamart-web`; verify SMTP/R2 values |
| Port 8080/3000 unreachable externally | Expected — only Nginx (80/443) is exposed; check `ufw status` |
| WebSocket streams don't connect | Confirm WS URL uses `wss://yourdomain/api/v1/...`; Nginx already forwards Upgrade headers |

## Rollback safety

Deploys never touch the running release until the new build succeeds, so a failed
build cannot take the site down. `update.sh` additionally backs up the database
before releasing and auto-rolls-back (symlink + `pm2 reload` + health check) if the
new release fails to come up.

## Uninstall

```bash
./uninstall.sh           # removes apps, nginx site, cron, /opt/vegamart (keeps OS packages)
./uninstall.sh --purge   # also removes nginx/postgres/node/etc.
```
