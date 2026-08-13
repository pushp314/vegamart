# VegaMart Deployment Automation

This directory contains the production-grade deployment toolkit for VegaMart. It fully automates the provisioning, deployment, updating, and health-checking of the application on an Ubuntu VPS.

## Architecture

- **OS**: Ubuntu 22.04 LTS or 24.04 LTS
- **Process Manager**: PM2 (for both the Express backend and the Nitro Node frontend server)
- **Reverse Proxy**: Nginx
- **Database**: PostgreSQL (Local)
- **Cache**: Redis (Local)
- **SSL**: Let's Encrypt / Certbot
- **Release Strategy**: Atomic symlink deployments (zero-downtime capable)

## Commands

To use the toolkit, you can either call the scripts directly via `sudo ./deploy/vegamart.sh <command>` or, if linked to `/usr/local/bin`, use `sudo vegamart <command>`.

- `sudo vegamart install`: First-time server provisioning and deployment.
- `sudo vegamart update`: Fetch the latest code and safely deploy it.
- `sudo vegamart rollback`: Revert the application symlink to the previous healthy release.
- `sudo vegamart status`: Check the status of the application and its dependencies.
- `sudo vegamart health`: Run HTTP and PM2 health checks.
- `sudo vegamart doctor`: Run comprehensive system diagnostics.
- `sudo vegamart logs [backend|frontend|nginx|all]`: Tail logs for specific services.
- `sudo vegamart restart [backend|frontend|nginx|redis|all]`: Safely restart services.
- `sudo vegamart backup`: Create a PostgreSQL database backup manually.
- `sudo vegamart restore /path/to/backup.sql.gz`: Restore a database backup.
- `sudo vegamart ssl`: Request or renew SSL certificates via Let's Encrypt.
- `sudo vegamart cleanup`: Delete old releases to save disk space (keeps last 5).

## Directory Structure

```
/opt/vegamart/
├── shared/
│   ├── .env              # Secrets and configuration (Not checked into Git)
│   ├── backups/          # Database backups
│   └── uploads/          # Persistent file uploads
├── releases/
│   ├── 20260813-214500-abc1234/
│   └── 20260814-093000-def5678/
└── current -> /opt/vegamart/releases/20260814-093000-def5678/
```

## Security

- PostgreSQL and Redis are bound to `127.0.0.1` and secured with passwords.
- UFW firewall blocks all external access except ports `22`, `80`, and `443`.
- `.env` files are stored outside of the Git repository in the `shared` folder with strict `600` permissions.
- PM2 runs as a dedicated `vegamart` unprivileged user.

## Important Note on Rollbacks

The `sudo vegamart rollback` command **only rolls back the application code and PM2 process**. It **does NOT** rollback the PostgreSQL database schema. If an incompatible schema change was made, you must manually run `sudo vegamart restore` with a backup from before the deployment, or apply a downward migration.
