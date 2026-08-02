# systemd — service management notes

PM2 manages both application processes (`vegamart-api`, `vegamart-web`). Boot-time
startup is handled by `pm2 startup systemd`, which installs a `pm2-root` systemd
unit automatically (configured in `setup-pm2.sh`). No hand-written unit is required
for the apps.

This directory contains reference material only.

## Files

- `pm2-vegamart.service` — example unit equivalent to what `pm2 startup` generates.
  Not installed by the toolkit (PM2's own unit is used).

## Optional: systemd healthcheck timer

If you prefer a systemd timer over the cron entry, create:

```
# /etc/systemd/system/vegamart-healthcheck.service
[Unit]
Description=Vegamart health check

[Service]
Type=oneshot
ExecStart=/opt/vegamart/deploy/healthcheck.sh --quiet

# /etc/systemd/system/vegamart-healthcheck.timer
[Unit]
Description=Run Vegamart health check every 5 minutes

[Timer]
OnBootSec=1min
OnUnitActiveSec=5min
Unit=vegamart-healthcheck.service

[Install]
WantedBy=timers.target
```

Then: `systemctl daemon-reload && systemctl enable --now vegamart-healthcheck.timer`

The toolkit's default is the cron entry installed by `setup-monitoring.sh`; the two
can coexist harmlessly (both only log failures).
