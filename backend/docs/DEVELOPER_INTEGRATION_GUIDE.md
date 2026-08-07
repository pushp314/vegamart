# Maintenance Mode Control — Integration Guide

How to control VegaMart **maintenance mode**. There is no API key and no token —
enable/disable is done with two localhost-only endpoints from the server itself,
and the public status endpoint lets clients detect downtime.

---

## 1. Endpoints

| Method | Path | Reachable from | Description |
| ------ | ---- | -------------- | ----------- |
| GET | `/api/v1/system/maintenance/status` | anywhere | Public maintenance flag + message |
| POST | `/api/v1/system/maintenance/on` | localhost only | Enable maintenance (message: "Contact the developer") |
| POST | `/api/v1/system/maintenance/off` | localhost only | Disable maintenance |

The `/on` and `/off` toggles are rejected with `403 FORBIDDEN` for any request that
does not originate from the server itself (`127.0.0.1` / `::1`). Run them over SSH.

---

## 2. Enable maintenance

```bash
curl -X POST http://127.0.0.1:8080/api/v1/system/maintenance/on
```

```json
{
  "success": true,
  "data": {
    "maintenanceEnabled": true,
    "maintenanceMessage": "Contact the developer",
    "updatedBy": "local:operator",
    "updatedAt": "2026-08-07T02:00:00.000Z"
  },
  "message": "Maintenance mode enabled."
}
```

## 3. Disable maintenance

```bash
curl -X POST http://127.0.0.1:8080/api/v1/system/maintenance/off
```

```json
{ "success": true, "data": { "maintenanceEnabled": false }, "message": "Maintenance mode disabled." }
```

> Adjust the port if the API is not listening on `8080` (check `pm2 describe vegamart-api`).

## 4. Public status (no auth)

```bash
curl http://127.0.0.1:8080/api/v1/system/maintenance/status
# { "success": true, "data": { "maintenance": false, "message": null } }
```

---

## 5. What happens when maintenance is on

- Every public request receives `503 Service Unavailable`:
  ```json
  { "maintenance": true, "message": "Contact the developer" }
  ```
- Excluded (stay live): `/`, Swagger `/docs`, `/health`, `/metrics`, and the whole
  `/system/*` namespace (so the toggles and status remain reachable).
- The gate **fails open**: if the state cannot be read, traffic is allowed through,
  so a database outage never causes an unplanned full shutdown.

---

## 6. Client / frontend integration

The web app redirects to `/maintenance` whenever it detects maintenance:

- **API clients:** any `503` whose body is `{ "maintenance": true, ... }` triggers a
  redirect to `/maintenance` (see `src/lib/api.ts` in `gali-connect-main`).
- **Root watcher:** polls `GET /system/maintenance/status` every 30s and redirects
  automatically; the `/maintenance` page polls every 15s and auto-returns home once
  the flag clears.

---

## 7. Configuration (backend `.env`)

| Variable | Default | Notes |
| -------- | ------- | ----- |
| `MAINTENANCE_RATE_LIMIT_WINDOW_MS` | `60000` | Rate limit window for toggle/status endpoints |
| `MAINTENANCE_RATE_LIMIT_MAX` | `20` | Max requests per window |
| `MAINTENANCE_CACHE_TTL_MS` | `10000` | State cache TTL before re-reading the database |
| `MAINTENANCE_DEFAULT_MESSAGE` | built-in default | Fallback banner text |

None of these are required — the module works out of the box with the defaults.

---

## 8. Implementation notes

- Maintenance state is a single row in `system_settings`
  (`id = 00000000-0000-0000-0000-000000000001`, columns `maintenance_enabled` /
  `maintenance_message`). It can also be flipped directly via SQL.
- Every enable/disable action is written to `maintenance_audit_logs`.
- Source lives in `backend/src/modules/maintenance/`.
