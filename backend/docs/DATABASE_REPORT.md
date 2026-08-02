# Database Report — Prisma / PostgreSQL

Date: 2026-08-01

## Schema health

- **41 Prisma models** in `src/prisma/schema.prisma`, **6 migration directories** in `prisma/migrations`.
- `prisma generate` / validation clean (backend build + tests pass, indicating a valid schema).
- Enums are lowercase DB-mapped consistently:
  - `DeliveryStatus` = pending / approved / rejected / suspended
  - `VendorStatus` = pending / approved / rejected / suspended
  - `KycStatus` = not_submitted / pending / verified / rejected
  - `OrderStatus` = PENDING … DELIVERED / CANCELLED / REFUNDED / RETURNED / FAILED

## Key models used by integration layer

| Model | Role |
| --- | --- |
| `VendorProfile` | Vendor business profile; **no `subscription_plan` column** — plan persisted via `Setting` table |
| `CmsOffer` / `CmsBanner` / `CmsFaq` | Admin CMS content (create via admin aliases; `sub→description`, `tag→discount`, `type→position`, `link_url→link`) |
| `Setting` (`key`, `value` Json) | Generic key/value store; used for `vendor_subscription:<id>` persistence |
| `DeliveryTracking` | Live driver location + ETA for order tracking |
| `Address` | `label, full_address, landmark, city, state, pincode, phone, is_default` (+ lat/lng) |
| `AuditLog` | Audit trail for sensitive actions |

## Response shaping

- Decimal (`Decimal` Prisma type) values are converted to JS numbers where the frontend needs them (order totals, earnings, revenue).
- The subscription plan merge: `getMyVendor` reads `Setting.getByKey("vendor_subscription:<id>")` and injects `subscription_plan` into the response.

## Risks / recommendations

1. No index audit performed this session — add composite indexes for high-traffic lookups (e.g. `Product(vendor_id, is_active)`, `Order(user_id, status)`, `DeliveryTracking(order_id)`).
2. `Setting.value` is JSON; ensure writes are upserted atomically (`settingsRepo.upsertSetting`) — already the pattern used.
3. Consider a `VendorProfile.subscription_plan` column if subscription queries become hot; the Setting fallback is fine at current scale.
4. Verify `prisma migrate deploy` ordering in CI (6 migrations present; no drift detected in tests).
