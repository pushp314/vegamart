# Deployment Scorecard

Date: 2026-08-01

Scoring: 1–5 per axis. 5 = production-grade, 1 = not deployable.

| Axis | Score | Rationale |
| --- | --- | --- |
| Frontend ↔ backend compatibility | 5 | Every frontend call maps to a verified backend route with matching method/path/body/envelope; residual mismatches fixed. |
| Backend correctness & tests | 4 | 340/340 tests green (36 suites), tsc + build clean. -1 for intermittent teardown warning and no coverage gate. |
| Frontend correctness | 4 | tsc + production build green; all integration-critical flows spot-checked. -1 for no test harness + ~916 lint errors. |
| Security | 4 | JWT/RBAC/audit/upload validation solid; WS token handshake + OTP/password-reset per-identifier rate limiting + Google OAuth (JWKS-verified) added. -1 for no WS per-room ownership check and no account-level email lockout. |
| Data layer | 4 | Valid Prisma schema (41 models, 6 migrations), Decimal handling correct. -1 for no index audit. |
| Performance | 4 | Caching + realtime room fan-out + pagination present; -1 for unverified N+1 on some lists and large client bundles. |
| Operations / deployability | 4 | `prisma migrate deploy` path, env-var config, nginx.conf present, `npm run build` reproducible. -1 for unverified SMTP/upload bucket/RAZORPAY credentials. |

## Total

| Category | Points (max 35) |
| --- | --- |
| Staging deployment | **30 / 35** (compatible, correct, buildable) |
| Public production | **29 / 35** (remaining: WS per-room ownership, account-level lockout, index audit, CI coverage gate) |

## Deploy order (recommended)

1. `prisma migrate deploy` + seed (categories, products, super-admin).
2. Configure env: `DATABASE_URL`, `JWT_SECRET` (strong), `REFRESH_TOKEN_SECRET`, `RAZORPAY_KEY_ID/SECRET`, SMTP, upload storage creds, `PORT=8080`.
3. Build backend (`npm run build`), build frontend (`npm run build`), serve via `nginx.conf` proxy with `/api/v1` → backend.
4. Post-deploy smoke: register→login, OTP login, Google login (once `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` are set), add address, checkout (COD + Razorpay test), vendor register/KYC/go-live + ring-bell, delivery accept + tracking WS, admin CMS + refund.
