# VegaMart

VegaMart is a hyper-local marketplace application containing a Node.js Express backend and a Vite TanStack Start frontend.

## Production Deployment

VegaMart comes with a fully automated, production-grade deployment system for Ubuntu Linux VPS environments. The system automates Node.js, PostgreSQL, Redis, PM2, Nginx, SSL, and firewall configurations.

### 1. First-time Installation

On a fresh Ubuntu 22.04/24.04 server, clone the repository and run the installation script:

```bash
git clone https://github.com/pushp314/vegamart.git
cd vegamart
sudo ./deploy/install.sh
```

You will be prompted for:
- Domain name (e.g., `vegamart.example.com`)
- SSL Email (for Let's Encrypt certificates)
- PostgreSQL password (or leave blank to auto-generate)

### 2. Updating

To fetch the latest code from Git and perform an atomic release update (zero-downtime):

```bash
sudo vegamart update
```

### 3. Rollbacks

If a deployment fails, you can instantly rollback the application code to the previous healthy release:

```bash
sudo vegamart rollback
```
*(Note: Database migrations must be managed/restored manually if they introduced breaking changes).*

### 4. Diagnostics & Management

The deployment toolkit exposes a `sudo vegamart <command>` wrapper for managing the server.

- **Check Status**: `sudo vegamart status`
- **Health Checks**: `sudo vegamart health`
- **System Doctor**: `sudo vegamart doctor`
- **View Logs**: `sudo vegamart logs [backend|frontend|nginx|all]`
- **Restart Services**: `sudo vegamart restart all`
- **Database Backup**: `sudo vegamart backup`
- **Database Restore**: `sudo vegamart restore /path/to/backup.sql.gz`

For more details, see the documentation in [`deploy/README.md`](deploy/README.md).
