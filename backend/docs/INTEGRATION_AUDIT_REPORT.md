# Integration Audit Report — Vegamart Frontend ↔ Backend

Date: 2026-08-01
Scope: `gali-connect-main` (React 19 / TanStack / Vite frontend) ↔ `backend` (Express / TypeScript / Prisma / PostgreSQL API).
Method: exhaustive cross-reference of every frontend API call against the full backend route/contract inventory.

## Baseline

- Backend: 296 tests / 35 suites green, `tsc`/`build`/`eslint` clean, Prisma valid.
- Frontend: `vite build` and `tsc --noEmit` green. `eslint` has ~916 pre-existing errors (Lovable-generated; mostly `prettier/prettier` + `no-explicit-any` in presentation code) — tracked as technical debt, not integration.
- Backend response envelope: `{ success, data, message?, pagination? }` success; `{ success:false, error:{code,message,details?}, requestId }` failure.
- Frontend client: `src/lib/api.ts` — JWT Bearer from localStorage, auto-refresh on 401, base URL `http://localhost:8080/api/v1`.

## Summary of Findings

| Severity | Count | Description |
| --- | --- | --- |
| **Critical** | 6 | Frontend calls endpoints that do not exist → core flows 100% broken (auth OTP, checkout, delivery portal, vendor earnings/KYC, order status, notifications). |
| **High** | 12 | Contract mismatches on existing endpoints (method, field names, path) → requests fail or return wrong shape. |
| **Medium** | 8 | Missing content/browse endpoints (banners, offers, faqs, trending, recommended, broadcasts, ring-bell, WebSocket streams). |
| **Low** | 7 | Cosmetic/naming issues, localStorage-only flows, Google auth unavailable, error-shape mismatches. |

---

## CRITICAL — Endpoint does not exist (frontend calls it, backend 404s)

| # | Frontend call | Backend reality | Impact |
| --- | --- | --- | --- |
| C1 | `POST /auth/login/otp/send` `{email,purpose}` | Only `POST /auth/otp/send` `{identifier,purpose}` | OTP login broken |
| C2 | `POST /auth/login/otp/verify` `{email,otp,purpose}` | Only `POST /auth/login/otp` `{email,otp}` | OTP login broken |
| C3 | `POST /checkout/create-order` | Backend has `POST /checkout` (placeOrder) | Checkout broken |
| C4 | `GET /delivery/*`, `POST /delivery/*` (me, requests, my-deliveries, register, apply, kyc, location, orders accept/status/delivered, tracking) | No `/delivery` routes exist | Delivery partner portal 100% broken |
| C5 | `GET /orders/vendor`, `PUT /orders/:id/status` | Vendor order routes are `GET/PATCH /vendors/orders...` | Vendor order dashboard broken |
| C6 | `GET /vendors/me/kyc`, `POST /vendors/me/kyc`, `GET /vendors/me/earnings`, `POST /vendors/register`, `PUT /vendors/me/profile`, `PUT /vendors/me/toggle-availability` | Only some exist under different paths | Vendor onboarding/portal broken |

## HIGH — Contract mismatch on existing endpoint

| # | Frontend | Backend | Fix |
| --- | --- | --- | --- |
| H1 | `POST /auth/reset-password` body `{new_password}` | expects `{password}` | rename field (frontend) |
| H2 | `PUT /users/me` (profile) | `PATCH /users/me` | frontend → PATCH |
| H3 | `GET /coupons/validate?code=&amount=` | `POST /coupons/validate` `{code}` returns `{code,coupon_id,type,discount,valid}` | frontend → POST + use server `discount` |
| H4 | `/users/me/addresses...` | canonical `/addresses...` | add backend alias mount |
| H5 | `POST /users/me/recently-viewed`, `GET /users/me/recently-viewed`, `GET /users/me/recommended` | not implemented | add backend endpoints |
| H6 | `PUT /notifications/:id/read`, `PUT /notifications/read-all` | `POST /notifications/:id/read`, `POST /notifications/read-all` | frontend → POST |
| H7 | `POST /uploads` (FormData `file`) | `POST /upload/image` (multer `file`) | frontend → `/upload/image` |
| H8 | `POST /vendors/:id/ring-bell` | not implemented | add backend + WS alert |
| H9 | `GET /admin/vendors`, `/admin/users`, `/admin/delivery` — read `res.data` as array | backend returns rows under `data` + `pagination` | frontend unwrap `res.data` (ok) — but `GET /admin/delivery` must be `/admin/delivery-partners` |
| H10 | `PUT /admin/vendors/:id/approve\|reject\|suspend`, `PUT /admin/users/:id/status`, `PUT /admin/delivery/:id/approve\|reject` | `POST /admin/vendors/:id/review\|suspend`, `POST /admin/users/:id/suspend\|activate`, `POST /admin/delivery-partners/:id/review` | add backend alias routes |
| H11 | `POST /admin/cms/{offers,banners,faqs}`, `PUT /admin/products/:id/feature` | CMS models exist but no routes | add backend endpoints |
| H12 | `GET /orders` expects list w/ `reorder`/`return`; `POST /orders/:id/reorder\|return` | no reorder/return | add backend endpoints |

## MEDIUM — Missing content/browse endpoints

| # | Frontend | Backend reality |
| --- | --- | --- |
| M1 | `GET /banners` | `CmsBanner` model exists, no endpoint |
| M2 | `GET /offers` | `CmsOffer` model exists, no endpoint |
| M3 | `GET /faqs` | `CmsFaq` model exists, no endpoint |
| M4 | `GET /products/trending` | not implemented (can use `total_sold` ordering) |
| M5 | `GET /broadcasts`, `POST /broadcasts`, `DELETE /broadcasts/:id` | `Broadcast` model exists, no endpoint |
| M6 | WebSocket `/vendors/stream-roaming`, `/vendors/:id/stream-alerts`, `/delivery/order/:id/stream` | no WebSocket layer at all |
| M7 | `GET /delivery/order/:id/tracking` | `DeliveryTracking` model exists, no endpoint |
| M8 | `GET /auth/google/url`, `POST /auth/google/callback` | no Google OAuth in backend |

## LOW — Minor

| # | Finding |
| --- | --- |
| L1 | `sendOTP`/`verifyOTP` are exposed but unused by pages; still wired to wrong endpoints |
| L2 | Frontend never stores `refresh_token` from login/register/guest → 401 auto-refresh can't work |
| L3 | `logout` sends `{refresh_token:""}` instead of the real token |
| L4 | Google login button shown but backend has no OAuth → must be hidden or degraded |
| L5 | Wishlist is localStorage-only; backend `/wishlist` endpoints exist but unused — acceptable (offline-first) but note asymmetry |
| L6 | Cart is localStorage-only; backend `/cart` endpoints exist but unused — order placement therefore uses `POST /checkout` from cart items the frontend never syncs → **checkout must push cart items** (see fix plan) |
| L7 | `order-success`/tracking consume `order.vendor.business_name`, `order.address.line1` — backend `OrderDetail` doesn't embed vendor/address objects |

---

## Fix Plan

**Backend (add, keep existing contract intact):**
1. Auth aliases: `POST /auth/login/otp/send`, `POST /auth/login/otp/verify`.
2. Coupon: `GET /coupons/validate?code=` alias.
3. Addresses: mount `/users/me/addresses...` alias router.
4. Checkout: `POST /checkout/create-order` alias → placeOrder.
5. Upload: `POST /uploads` alias → uploadImage.
6. Orders: `GET /orders/vendor` (before `:order_id`), `POST /orders/:id/reorder`, `POST /orders/:id/return`.
7. Vendor self-service: `POST /vendors/register`, `PUT /vendors/me/profile`, `PUT /vendors/me/toggle-availability`, `GET /vendors/me/earnings`, `GET/POST /vendors/me/kyc`, `POST /vendors/:id/ring-bell`.
8. Delivery module: `register/apply/me/requests/my-deliveries/orders/:id/accept|status|delivered/location/tracking/me/kyc`.
9. Content: `GET /banners`, `GET /offers`, `GET /faqs`, `GET /products/trending`, `GET/POST /users/me/recently-viewed`, `GET /users/me/recommended`, `GET/POST/DELETE /broadcasts`.
10. Admin aliases: vendor approve/reject/suspend, user status, delivery approve/reject, `GET /admin/delivery`, CMS offers/banners/faqs, `PUT /admin/products/:id/feature`.
11. WebSocket realtime layer (`ws`): roaming stream, vendor alert stream, delivery order stream; wired into vendor location updates, ring-bell, delivery status/location.
12. Tests for new endpoints.

**Frontend (align to backend contract):**
1. `api.ts`: add `patch()`; store `refresh_token` on session save; fix skip-list; `logout` sends real token.
2. `auth-context.tsx`: OTP endpoints, reset-password `password` field, profile PATCH, remove Google (hide button), store refresh token.
3. `cart-context.tsx`: coupon via POST `/coupons/validate`, use server `discount`; sync cart to backend before checkout.
4. `checkout.tsx`: use `/checkout` + `/checkout/preview`; Razorpay from `payment.razorpay_order_id`.
5. `addresses.tsx` / `use-location.ts`: `/addresses`.
6. `profile.tsx`: `/upload/image`.
7. `notifications.tsx`: POST read endpoints.
8. `vendor.tsx` / `vendor.roaming.tsx`: `/vendors/orders`, `PATCH /vendors/orders/:id/status`, `/vendors/me` profile, `/upload/image`, KYC/earnings endpoints.
9. `orders.tsx` / tracking: reorder/return, tracking endpoint.
10. `delivery.tsx`: wire to `/delivery/*`.
11. `admin.tsx` + admin components: new admin endpoints + `/admin/delivery-partners`.
12. `index.tsx`: banners/offers/faqs/trending/recent/recommended endpoints.
13. `street-vendors.tsx` / `street-broadcasts.ts` / `street-vendor-map.tsx`: `/broadcasts`, ring-bell, WS streams.

See final reports for post-fix verification status.
