# Final Production Release Report

Date: 2026-08-05
System: `vegamart` — Express/Prisma/PostgreSQL backend (`backend`) + React 19/TanStack/Nitro frontend (`gali-connect-main`).

## Overall verdict

**APPROVED WITH MINOR RISKS** — every release-blocking functional defect and critical security defect found during audit has been fixed and re-verified. The app is deployable. Residual items are configuration/hardening risks that require action **at/after deploy**, not code blockers.

## Gates run this session (all green)

| Gate | Result |
| --- | --- |
| Backend `tsc --noEmit` | PASS (0 errors) |
| Backend `eslint src/**/*.ts` | PASS (0 problems) |
| Backend `jest` | PASS — 355/355 tests, 38/38 suites |
| Backend server boot (import/runtime smoke) | PASS — boots to listen; realtime layer initializes |
| Frontend `tsc --noEmit` | PASS (0 errors) |
| Frontend `npm run build` (Nitro) | PASS |
| Frontend `eslint` | 401 pre-existing `no-explicit-any` errors (documented baseline, unchanged; no new categories) |

## Defects fixed this session

### Blocking (release-critical)
1. **Checkout completely broken** — `checkout.tsx` read a flat `{total, razorpay_order_id}` shape; the API (`POST /orders` → `createOrderFromCart`) returns `{summary, orders:[{order, payment}]}`. Razorpay opened with `undefined` order id and COD navigated to an empty success page. Now unwraps `orders[0].order` + `payment.razorpay_order_id`, supports sequential per-order payment for multi-vendor carts, and navigates with the real order id. (Also confirmed the backend validator already normalizes `upi`/`card` → Razorpay intent, so the flow is server-correct.)
2. **Coupon discount displayed as NaN / wrong** — `cart-context.applyCoupon` read `coupon.value`/`coupon.max_discount` (not returned by `/coupons/validate`) against an empty server cart. Now uses the backend-computed `discount`, and sends the client cart `items` so `/coupons/validate` validates against the actual purchase (backend computes with current product prices). Also fixed a latent backend bug where category-restricted coupons never matched (`categoryIds` was never populated in `cartContext`).
3. **Vendor dashboard empty for approved vendors** — backend returned `status` as UPPERCASE enum (`APPROVED`/`PENDING`/…); `vendor.tsx`/`vendor.roaming.tsx` compared lowercase. Normalized `status` to lowercase in the `GET/PUT /vendors/me` and `POST /vendors` responses (internal server-side UPPERCASE comparisons untouched).
4. **Vendor Reviews tab always 404** — `VendorReviews.tsx` calls `GET /vendors/me/reviews`, which did not exist. Added the endpoint (reviews across the vendor's products with user/product info).

### Security (high)
5. **Plaintext OTP/token logging** — `email.service.ts` logged verification tokens, reset OTPs, and login OTPs. Removed; logs only that an email was sent.
6. **`/auth/resend-verification` leaked the raw verification token in the response** and was unauthenticated/unthrottled. Token no longer returned; route now requires auth + auth/OTP rate limiters.
7. **Banned/suspended users could keep refreshing sessions** — `auth.service` refresh only checked `deleted_at`. Now rejects `SUSPENDED`/`BANNED`/`INACTIVE` and revokes the refresh token.
8. **Admin endpoints unauthenticated** — `/vendors/:id/review` and `/vendors/:id/suspend` (vendor.routes) and the 3 category admin routes used `requirePermission` without `authenticate`. On a 401 the permission middleware resolves no user → privilege escalation window. `authenticate` added to all of them.
9. **Admin role-escalation hole** — a plain `admin` could promote a second account to `admin`/`super_admin` via `PATCH /admin/users/:id/role`. Now only a super_admin can grant admin-level roles.
10. **WebSocket room authorization** — the realtime layer verified a valid token but **not ownership**: any authenticated user could join any `vendor:<id>` alert stream or `order:<id>` GPS stream. Added per-room ownership checks (vendor must own the profile; order room open only to the customer, the assigned delivery partner, or the order's vendor).

### Correctness (high/medium)
11. **Order status display/cancel mismatches** — `orders.tsx` allowed Cancel on statuses the backend rejects (`processing`/`prepared` → only `PENDING`/`CONFIRMED` are cancelable) and used a status-label map that didn't match the real `OrderStatus` enum. Fixed map (all 12 enum states) and cancel gating. `order-success.tsx`/`order-tracker.tsx` now normalize UPPERCASE backend status and map the real enum stages.
12. **Homepage "Recently Viewed" rendered empty** — the API returns `{viewed_at, product:{…}}`; the component read flat `p.id`/`p.name`/`p.image`. Now unwraps the nested product and builds a valid cart item for add-to-cart.
13. **Vendor Coupons tab always 403** — it calls admin-only `/coupons` endpoints a vendor can't access. Removed the tab from the vendor dashboard (coupons remain an admin function).
14. **VendorAnalytics fabricated daily revenue** — the weekly chart was a fake percentage split of `weekly_revenue`. Replaced with an honest chart of real aggregates (today/weekly/monthly/total).
15. **Roaming vendor WS used wrong env var** (`VITE_API_URL`, undefined) — now uses `WS_BASE_URL` from `@/lib/api`.
16. **Become-vendor role not reflected in UI** — after registering a vendor profile the cached session still showed `customer`; now `refreshSession()` is called on success.

### Data layer
17. **`vendor_daily_locations` missing from migration history** — model existed in schema but no migration. Added `20260802000000_add_vendor_daily_locations` (table + indexes + FK). Dev DB already has the table (db-push managed); see deploy risk below.

## Scores (1–5)

| Axis | Score | Rationale |
| --- | --- | --- |
| Frontend ↔ backend compatibility | 5 | All audited mismatches (checkout shape, coupon response, vendor status case, reviews 404, recently-viewed nesting) fixed and re-verified against source of truth. |
| Backend correctness & tests | 5 | 355/355 tests (38 suites), tsc + eslint clean, server boots. |
| Frontend correctness | 4 | tsc + production build green; all integration-critical flows fixed. −1: no frontend test harness, ~401 pre-existing `no-explicit-any` lint errors. |
| Security | 4 | All critical escalators closed (token/OTP logging, token leak, refresh for banned users, unauthenticated admin routes, role escalation, WS room ownership). −1: admin routes still enforce role-level rather than the granular permission model; `requireRole` reads the JWT claim (window mitigated by session revocation on role change). |
| Data layer | 4 | Schema valid, Decimal handling correct, missing migration added. −1: migrations directory (`backend/prisma/migrations`) does not match the `--schema src/prisma/schema.prisma` resolution used by `prisma:migrate`/`prisma:deploy` (see deploy risk). |
| Operations / deployability | 4 | Builds reproducible, nginx.conf + env config present. −1: migrations-path discrepancy, unverified external creds (SMTP/R2/Razorpay/Google). |

**Total: 26 / 30** (APPROVED WITH MINOR RISKS).

## Must-do at/just before deploy

1. **Resolve the migrations-path discrepancy.** Migrations live in `backend/prisma/migrations`, but `prisma migrate deploy --schema src/prisma/schema.prisma` resolves migrations to `src/prisma/migrations` (empty) — deploy would find no history. Either move/copy `migrations/` next to the schema, or keep the current db-push workflow and apply the new `vendor_daily_locations` DDL separately. Confirm the target DB has `_prisma_migrations` or run the new migration file manually.
2. Set env: `DATABASE_URL`, strong `JWT_SECRET`/`REFRESH_TOKEN_SECRET`, `RAZORPAY_KEY_ID/SECRET`, SMTP, upload storage creds, `PORT=8080`, and `GOOGLE_CLIENT_ID/SECRET` (to enable Google login).
3. `prisma generate`, seed categories/products, create a super-admin.
4. Restart the backend dev instance (currently running pre-fix code on :8080).

## Residual minor risks (non-blocking, documented)

- Multi-vendor carts open a separate Razorpay intent per vendor order sequentially (works; UX could be consolidated).
- Admin surface is role-broad: a plain `admin` can still perform delete actions via admin routes (mitigation: role escalation to `admin`/`super_admin` now requires super-admin).
- No frontend automated tests; coupon display discount may vary by a few paise if product prices change between validate and order (order charges are server-authoritative).
- Unverified live credentials for SMTP/R2/Razorpay/Google.
