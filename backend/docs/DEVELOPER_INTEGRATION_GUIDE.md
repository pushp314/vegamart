# Maintenance Mode Control — Integration Guide

Control VegaMart **maintenance mode** with two browser links. No API keys, no tokens
to exchange — just set one secret value and paste the URLs.

---

## 1. The two links

| Action | URL |
| ------ | --- |
| Enable | `https://api.vegamart.in/api/v1/system/maintenance/on?token=<TOKEN>` |
| Disable | `https://api.vegamart.in/api/v1/system/maintenance/off?token=<TOKEN>` |

Paste them into any browser (or bookmark them). Enabling uses the message
**"Contact the developer"**.

There is also a public status endpoint:
`GET https://api.vegamart.in/api/v1/system/maintenance/status` (no token needed).

---

## 2. Setting the token

Add one variable to the backend `.env` and restart the API:

```
MAINTENANCE_TOGGLE_TOKEN=some_long_random_string
```

Generate one with `openssl rand -hex 32`. Anyone with this URL can toggle
maintenance, so keep it secret (don't share/bookmark in public browsers).

If `MAINTENANCE_TOGGLE_TOKEN` is left empty, the links only work when called from
the server itself (loopback) — e.g. over SSH with curl — and return `403` for
remote requests.

---

## 3. What the toggle responses look like

Enabling:
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

Disabling:
```json
{ "success": true, "data": { "maintenanceEnabled": false }, "message": "Maintenance mode disabled." }
```

Missing or wrong token: `401 UNAUTHORIZED`. Remote request with no token configured:
`403 FORBIDDEN`.

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
| `MAINTENANCE_TOGGLE_TOKEN` | empty | Enables the toggle links from anywhere; empty = loopback-only |
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
