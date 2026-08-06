# Remote Maintenance Control — Developer Integration Guide

Developer-facing documentation for the VegaMart **Remote Maintenance Control** module.
Use these endpoints to toggle maintenance mode remotely, update the user-facing banner
message, and audit developer actions — without SSH access to the server.

---

## 1. Overview

When maintenance mode is **enabled**, every request to the API (except the explicitly
excluded paths below) receives:

```
HTTP/1.1 503 Service Unavailable
Content-Type: application/json

{
  "maintenance": true,
  "message": "Scheduled maintenance from 2 AM to 4 AM IST."
}
```

The public status endpoint and the maintenance control namespace stay reachable so the
system can be switched back on remotely.

| Method | Path | Auth | Description |
| ------ | ---- | ---- | ----------- |
| GET | `/api/v1/system/maintenance/status` | none | Public maintenance flag + message |
| POST | `/api/v1/system/developer/token` | none (body apiKey) | Exchange API key for a short-lived JWT |
| POST | `/api/v1/system/maintenance/enable` | developer | Enable maintenance mode (optional message) |
| POST | `/api/v1/system/maintenance/disable` | developer | Disable maintenance mode |
| POST | `/api/v1/system/maintenance/update` | developer | Update the banner message |
| GET | `/api/v1/system/maintenance` | developer | Full state incl. last updater |
| GET | `/api/v1/system/maintenance/audit-logs?limit=N` | developer | Recent control actions |

**Base URL (production, verified):** `https://api.vegamart.in/api/v1`
**Base URL (local dev):** `http://localhost:8080/api/v1`

All maintenance control requests below are relative to the base URL above, e.g.
`https://api.vegamart.in/api/v1/system/maintenance/status`.

---

## 2. Authentication

Developer endpoints require **one** of:

- `Authorization: Bearer <jwt>` — short-lived token from `POST /system/developer/token`
  (default TTL 900s / 15 minutes, issuer/audience locked to the maintenance module), **or**
- `X-API-Key: <api_key>` — the static `MAINTENANCE_DEV_API_KEY` (compared in constant time).

Additional optional controls:

- `MAINTENANCE_DEV_IPS` — comma-separated IP allowlist; when set, only those IPs may
  control maintenance (empty = allow all).
- `MAINTENANCE_DEV_RATE_LIMIT_WINDOW_MS` / `MAINTENANCE_DEV_RATE_LIMIT_MAX` — rate limit
  on control + token endpoints (default 20 req / 60s). Exceeding returns `429 RATE_LIMITED`.

### 2.1 Issue a token

```bash
curl -X POST https://api.vegamart.in/api/v1/system/developer/token \
  -H "Content-Type: application/json" \
  -d '{"apiKey": "dev_..."}'
```

```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "expiresInSeconds": 900,
    "scope": "maintenance"
  }
}
```

Store the token securely (env var / secrets manager) and refresh it as needed.

---

## 3. Endpoints

### 3.1 Enable maintenance

```bash
curl -X POST https://api.vegamart.in/api/v1/system/maintenance/enable \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"message": "Scheduled maintenance from 2 AM to 4 AM IST."}'
```

`message` is optional (1–2000 chars). When omitted the server default is used.

```json
{
  "success": true,
  "data": {
    "maintenanceEnabled": true,
    "maintenanceMessage": "Scheduled maintenance from 2 AM to 4 AM IST.",
    "updatedBy": "jwt:developer",
    "updatedAt": "2026-08-07T02:00:00.000Z"
  },
  "message": "Maintenance mode enabled."
}
```

### 3.2 Disable maintenance

```bash
curl -X POST https://api.vegamart.in/api/v1/system/maintenance/disable \
  -H "Authorization: Bearer <jwt>"
```

```json
{ "success": true, "data": { "maintenanceEnabled": false }, "message": "Maintenance mode disabled." }
```

### 3.3 Update message (maintenance stays on)

```bash
curl -X POST https://api.vegamart.in/api/v1/system/maintenance/update \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"message": "Extended until 6 AM IST."}'
```

### 3.4 Public status (no auth)

```bash
curl https://api.vegamart.in/api/v1/system/maintenance/status
# { "success": true, "data": { "maintenance": false, "message": null } }
```

### 3.5 Full state + audit logs

```bash
curl https://api.vegamart.in/api/v1/system/maintenance -H "Authorization: Bearer <jwt>"
curl "https://api.vegamart.in/api/v1/system/maintenance/audit-logs?limit=50" \
  -H "Authorization: Bearer <jwt>"
```

Audit entries record `action` (`enabled`, `disabled`, `updated`, `token_issued`, `auth_failed`),
`developerId`, `ipAddress`, `userAgent`, `message`, and `createdAt`.

---

## 4. Maintenance gate behaviour

- Served normally during maintenance (excluded from the 503 gate):
  - `/` and `/api/v1/docs*` (Swagger UI)
  - `/api/v1/health*` and `/api/v1/metrics*`
  - the entire `/api/v1/system/*` namespace
- Everything else returns `503 { "maintenance": true, "message": ... }`.
- The gate **fails open**: if the state cannot be read, traffic is allowed through so a
  database outage never causes an unplanned full shutdown.

---

## 5. Client / frontend integration

The web app redirects to `/maintenance` whenever it detects maintenance:

- **API clients:** any `503` whose body is `{ "maintenance": true, ... }` triggers a
  redirect to `/maintenance` (see `src/lib/api.ts` in `gali-connect-main`).
- **Root watcher:** polls `GET /system/maintenance/status` every 30s and redirects
  automatically; the `/maintenance` page polls every 15s and auto-returns home once the
  flag clears.

> Since the status endpoint is excluded from the gate, clients can keep polling during
> downtime. Long-polling the status endpoint is a clean way to auto-restore traffic.

---

## 6. Environment variables (backend `.env`)

| Variable | Required | Default | Notes |
| -------- | -------- | ------- | ----- |
| `MAINTENANCE_DEV_API_KEY` | yes (to enable remote control) | – | Developer API key, ≥ 16 chars |
| `MAINTENANCE_DEV_JWT_SECRET` | yes (for token flow) | – | ≥ 32 chars, keep secret |
| `MAINTENANCE_DEV_JWT_TTL_SECONDS` | no | `900` | Token lifetime |
| `MAINTENANCE_DEV_JWT_ISSUER` | no | `vegamart-maintenance` | |
| `MAINTENANCE_DEV_JWT_AUDIENCE` | no | `vegamart-maintenance-client` | |
| `MAINTENANCE_DEV_IPS` | no | empty (all) | Comma-separated IP allowlist |
| `MAINTENANCE_DEV_RATE_LIMIT_WINDOW_MS` | no | `60000` | |
| `MAINTENANCE_DEV_RATE_LIMIT_MAX` | no | `20` | |
| `MAINTENANCE_CACHE_TTL_MS` | no | `10000` | State cache TTL |
| `MAINTENANCE_DEFAULT_MESSAGE` | no | built-in default | Fallback banner text |

---

## 7. TypeScript interfaces

```ts
interface PublicMaintenanceStatus {
  maintenance: boolean;
  message: string | null;
}

interface MaintenanceStatusDto {
  maintenanceEnabled: boolean;
  maintenanceMessage: string | null;
  updatedBy: string | null;
  updatedAt: string | null;
}

interface MaintenanceAuditLogDto {
  id: string;
  action: string;          // enabled | disabled | updated | token_issued | auth_failed
  developerId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  message: string | null;
  createdAt: string;
}

interface TokenResponse {
  token: string;
  expiresInSeconds: number;
  scope: string;
}
```

---

## 8. Example snippets

**fetch (TypeScript)**

```ts
const enableMaintenance = async (jwt: string, message?: string) => {
  const res = await fetch(`${BASE_URL}/system/maintenance/enable`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
    body: JSON.stringify(message ? { message } : {}),
  });
  return res.json();
};
```

**axios**

```ts
const api = axios.create({ baseURL: "https://api.vegamart.in/api/v1" });

await api.post("/system/developer/token", { apiKey: process.env.MAINTENANCE_API_KEY });

await api.post("/system/maintenance/enable", { message: "Scheduled maintenance." }, {
  headers: { Authorization: `Bearer ${token}` },
});
```

**React Native**

```ts
await fetch(`${BASE_URL}/system/maintenance/disable`, {
  method: "POST",
  headers: { "X-API-Key": API_KEY },
});
```

---

## 9. Security notes

- The API key is compared with `timingSafeEqual`; the JWT is signed with a dedicated
  secret and locked to the maintenance issuer/audience + `role: DEVELOPER`, `scope: maintenance`.
- Every control action (and every failed auth attempt) is written to `maintenance_audit_logs`.
- Rotate `MAINTENANCE_DEV_API_KEY` / `MAINTENANCE_DEV_JWT_SECRET` via the standard release
  process; enable `MAINTENANCE_DEV_IPS` to lock control to known developer IPs.

---

## 10. Postman

Import `postman/vegamart-maintenance.postman_collection.json` (repo root of `backend`).
Set `baseUrl`, `apiKey`, and (after step 2) `token` in the collection variables.
