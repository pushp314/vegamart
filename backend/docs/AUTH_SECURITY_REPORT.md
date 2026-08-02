# Auth & Security Report

Date: 2026-08-01

## Authentication flows (all verified)

| Flow | Mechanism |
| --- | --- |
| Email + password login / register | `POST /auth/login`, `POST /auth/register` → JWT access + refresh + serialized user |
| OTP login | `POST /auth/login/otp/send` {email} → `POST /auth/login/otp/verify` {email, otp} via `authService.resendOtp` / `loginWithOtp` |
| Guest session | `POST /auth/guest` |
| Token refresh | `POST /auth/refresh` with `{ refresh_token }` — frontend auto-retries on 401 |
| Logout | `POST /auth/logout` sends the real refresh token; refresh-token key cleared |
| Forgot / reset password | `POST /auth/forgot-password` {email} → OTP → `POST /auth/reset-password` {email, otp, password} |
| Google OAuth | `GET /auth/google/url` → `{url}`; browser redirects to frontend `/auth/callback?code=`; `POST /auth/google/callback` `{code}` exchanges + verifies the Google ID token (JWKS, RS256) and issues a session |

## Session storage (frontend)

- Keys: `vegamart_access_token`, `vegamart_refresh_token`, `vegamart_user`.
- `authStorage.saveSession` persists access + refresh + user; `clearSession` removes all three.
- `ApiClient` injects `Authorization: Bearer <access>` on every request and auto-refreshes once on 401 (refresh endpoints excluded from the retry loop).

## Authorization (backend RBAC)

- `authenticate` middleware + `requireRole(...)` / `requirePermission(...)`.
- Admin integration router enforces `requireRole(ROLES.ADMIN, ROLES.SUPER_ADMIN)` for all `/admin/*` aliases.
- Permission model: `ADMIN_PERMISSIONS` includes `PAYMENTS_REFUND`, `VENDORS_APPROVE`, `DELIVERY_APPROVE`, `USERS_MANAGE`, `CMS_MANAGE`, etc.
- Role upgrade paths: customer → vendor (`upgradeRole(vendor)`), customer → delivery partner; guarded by profile existence checks.

## Security posture

- Passwords hashed server-side; OTPs are 6-digit with purpose binding (`OtpPurpose`).
- Upload validation: file-type/size validation middleware (`file-validation` unit suite green); `deleteFile` rejects path traversal (`..`, leading `/`, oversized keys).
- Audit trail: sensitive actions (auth, vendor/delivery register, KYC, ring-bell, location update, admin mutations, Google login) recorded via `auditService.record`.
- Error envelope intentionally avoids leaking stack traces: `{ success:false, error:{code,message,details?}, requestId }`.
- **OTP delivery is email-only** (SMTP via nodemailer). No SMS provider is integrated; `OtpPurpose.PHONE_VERIFICATION` exists in the schema but nothing sends SMS. When SMTP is unconfigured, the mailer logs the OTP to the console (dev/test path) and OTP flows still complete.
- **Rate limiting:** `authLimiter` (IP) on login/register/forgot/reset + `otpLimiter` (IP + identifier, IPv6-aware via `ipKeyGenerator`) on all OTP send/verify/login and forgot/reset password routes.
- **WebSocket auth:** `/vendors/:id/stream-alerts` and `/delivery/order/:id/stream` require a valid `?token=` access token at the WS handshake (401 rejected); `/vendors/stream-roaming` stays public.
- **Google OAuth:** ID token signature verified against Google JWKS with `RS256`, `iss`, `aud`, and expiry checked; no password stored for Google-created accounts (random unusable hash).

## Remaining items

1. OAuth `state` parameter is generated and returned but not round-tripped by the frontend (CSRF via code-injection is mitigated by the one-time code + client-secret exchange, but state verification is recommended).
2. Per-room authorization ownership checks (e.g. confirm the WS token subject is the vendor/order owner) are a recommended next layer.
3. Account-linking policy: an existing `local` account signing in with Google is automatically linked (provider set to `google`). Confirm this matches product expectations.
