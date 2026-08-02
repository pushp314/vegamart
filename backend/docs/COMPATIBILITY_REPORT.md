# Compatibility Report — Frontend ↔ Backend Contract Alignment

Date: 2026-08-01
Scope: every API call issued by `gali-connect-main` mapped to a concrete `backend` route with matching method, path, body shape, and response shape.

## Method

- Extracted every `api.get/post/put/patch/delete` and `fetch` call from the frontend `src/`.
- Cross-referenced against the backend route inventory (`src/routes/v1/*.ts`, 23 route modules).
- Verified response unwrapping against the backend envelope `{ success, data, message?, pagination? }`.
- Verified WebSocket paths against `src/realtime/realtime.ts` room resolution.

## Result

| Area | Status |
| --- | --- |
| Auth (login, register, guest, OTP, refresh, logout, forgot/reset password) | Aligned |
| Catalog (categories, products, product detail, search, trending) | Aligned |
| Cart / Wishlist | Aligned (backend endpoints exist; frontend still uses localStorage — see TECH_DEBT) |
| Coupons | Aligned (`POST /coupons/validate`) |
| Addresses (`/users/me/addresses...`) | Aligned |
| Checkout (`/checkout/create-order`, `/checkout/preview`) | Aligned |
| Payments (`verify`, `:order_id/refund`) | Aligned |
| Orders (customer list, vendor list, reorder, return, delivery tracking) | Aligned |
| Notifications (list, read, read-all) | Aligned |
| Vendors (register, me, profile, availability, KYC, earnings, location, ring-bell) | Aligned |
| Delivery partner module (`/delivery/*`) | Aligned |
| Content/browse (banners, offers, faqs, trending, recently-viewed, recommended) | Aligned |
| Admin (vendors approve/reject/suspend, users status, delivery approve/reject, CMS offers/banners/faqs, product feature, refunds) | Aligned |
| Uploads (`POST /uploads` multipart `file`) | Aligned |
| WebSocket (roaming stream, vendor alert stream, delivery order stream) | Aligned |

## Contract invariants honored

1. Success envelope `{ success: true, data, message? }` — frontend reads `res.data` (single unwrap).
2. Error envelope `{ success: false, error: { code, message } }` — frontend reads `res.error?.message`.
3. `authStorage` keys `vegamart_access_token` / `vegamart_refresh_token` / `vegamart_user`.
4. Role slugs `customer` / `vendor` / `delivery` (+ `admin`, `super_admin`) used for route guarding.
5. WS event shapes:
   - `roaming_vendor_location` `{ vendor_id, lat, lng }` on `/vendors/stream-roaming`.
   - `gali_bell_alert` `{ address, note?, customer_name }` on `/vendors/:id/stream-alerts`.
   - `location_update` / `order_eta_update` / `order_status_update` on `/delivery/order/:id/stream`.

## Residual mismatches fixed this session

| File | Issue | Fix |
| --- | --- | --- |
| `src/routes/profile.tsx` | Upload response double-unwrapped (`uploadRes.data?.data?.url` always undefined) → avatar upload always failed | Read `uploadRes.data?.url` |

## Verification status

- Backend: `npx tsc --noEmit` ✓, `npm run build` ✓, jest `337 passed / 36 suites` ✓.
- Frontend: `npx tsc --noEmit` ✓, `npm run build` ✓.
- Spot-verified high-risk flows: vendor roaming + WS alerts, delivery tracking stream, admin CMS forms, admin refunds, profile upload, forgot/reset password.
