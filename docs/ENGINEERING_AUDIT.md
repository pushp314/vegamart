# Engineering Audit — 2026-08-04

## Executive summary

The application is a TanStack Start/React frontend (`gali-connect-main`) paired with an Express/TypeScript/Prisma PostgreSQL backend (`backend`). The backend has a conventional route → controller → service → repository structure; the frontend uses a shared fetch client, React Query, and context providers for auth, cart, and wishlist state.

The audit identified and repaired production-impacting integration, authentication, authorization, and hook-order defects. Backend verification is clean: typecheck, lint, build, and all 340 tests pass. Frontend TypeScript and production builds pass. Frontend lint remains a release blocker (1,033 violations after the hook repairs); it was not hidden by weakening lint rules.

## Architecture and inventories

All backend routes are mounted below `/api/v1`; `/api/v2` currently mirrors the main route surface. Every response uses the common `{ success, data?, error?, pagination? }` envelope. Validation is implemented with Zod in `backend/src/validators`, authentication uses Bearer JWTs, and role/permission enforcement is applied with route middleware.

| Area | Route modules | Main controllers/services | Auth model |
| --- | --- | --- | --- |
| Authentication | `auth.routes.ts` | Auth, token, OTP, Google OAuth | Public except account/session actions |
| Accounts | `user.routes.ts`, `address.routes.ts` | User, address | Authenticated; address endpoints require customer |
| Marketplace | category, vendor, product, inventory, search | Category, vendor, product, inventory, search | Browse public; mutation routes restricted |
| Commerce | cart, checkout, order, payment, coupon, wishlist | Cart, checkout, order, payment, coupon, wishlist | Customer or granular permission as appropriate |
| Operations | admin, notification, upload, broadcast, health, metrics | Admin, analytics, notifications, uploads | Admin, owner, or public health/read access |
| Compatibility | `integration.routes.ts` | Integration service/controllers | UI-compatible aliases protected by role where required |

The source inventory contains 197 backend route declarations, 39 frontend route components, and 54 explicit frontend `api.*` calls. The canonical route declarations provide the complete per-endpoint method, path, controller, middleware, and Zod schema inventory; each controller’s called service/repository traces its data access. The frontend inventory is located in `src/routes`, `src/components`, `src/context`, and `src/lib`; all client calls use `src/lib/api.ts` except the temporary-token onboarding calls in `AdminCreatePartner`.

### Frontend-to-backend contract results

| Workflow | Contract conclusion |
| --- | --- |
| Login, register, Google callback, OTP | Shared session storage now persists both access and refresh tokens; session refresh updates React state. |
| Delivery application | Role upgrade invalidated the old access token; the UI now refreshes the session before entering the delivery portal. |
| Vendor application | Registration now uses the auth context rather than manually manipulating token storage. |
| Checkout | Fixed: local-cart items are submitted to the frontend-compatible `POST /orders` endpoint, which synchronizes the server cart then invokes canonical checkout. |
| Addresses | Checkout now uses the UI-compatible `/users/me/addresses` aliases for both reads and writes. |
| Coupons | Fixed frontend `GET` contract mismatch to `POST /coupons/validate`. |
| Broadcasts | Fixed public write/delete authorization and ownership spoofing. |

## Fixed issues

1. Refresh tokens issued at login/register/OTP/Google/guest login were not consistently stored, preventing reliable refresh and logout behavior.
2. Expired/invalid sessions left stale refresh-token state behind.
3. Checkout posted UI items to `POST /checkout`, an endpoint that intentionally reads only the server cart. The real cart could be empty and order creation would fail.
4. The coupon UI invoked a nonexistent `GET /coupons/validate` contract.
5. Checkout queried the canonical address contract but rendered the alias address shape; its address form also wrote the alias payload to the canonical endpoint.
6. Delivery onboarding changed the database role while leaving the browser with a token containing the old role.
7. `POST /broadcasts` and `DELETE /broadcasts/:id` were public and trusted caller-supplied vendor identity. They now require a vendor JWT, derive the profile identity on the server, verify deletion ownership, and accept no client-controlled vendor identity fields.
8. Test runs inherited local `.env` credentials, making the OAuth configuration test environment-dependent. Tests now ignore local `.env` and explicitly disable Google OAuth.
9. Admin and checkout had conditional React Query hooks, which could produce hook-order runtime failures when authentication state changed. Queries are gated with `enabled`; guards run after hook declarations.

## Database, security, and performance audit

Prisma uses PostgreSQL, UUID identifiers, explicit foreign keys/cascades, role/permission tables, soft deletes on business records, pagination helpers, and six migration directories under `backend/prisma/migrations`. The schema has indexes on core lookup, status, and ownership columns. The backend uses Helmet, CORS controls, rate limiting, request IDs, validation, audit logging, upload validation, password hashing, JWT rotation, and ownership checks.

Security improvements made in this audit: broadcast writes are authenticated/owned; test runs no longer load developer secrets; and session state is cleared consistently on refresh failure. Remaining security work: access tokens remain in `localStorage`, so a successful XSS could steal them; move to an HTTP-only cookie/BFF model in a dedicated security change.

The frontend build warns of large client chunks: the home entry is about 543 kB minified and the admin route about 441 kB. The largest shared SSR libraries are router and charting bundles. Route-level code splitting exists, but dashboard/chart imports should be split further before a performance-sensitive launch.

## Verification

| Check | Result |
| --- | --- |
| Backend `npm run typecheck` | Pass |
| Backend `npm run lint` | Pass |
| Backend `npm run build` | Pass |
| Backend test suite | Pass — 36 suites, 340 tests |
| Frontend `tsc --noEmit` | Pass |
| Frontend production build | Pass |
| Frontend lint | Fails — 869 Prettier, 140 explicit-`any`, 9 exhaustive-dependency, 9 fast-refresh, 4 empty-block, 1 useless-catch, and 1 banned TypeScript-comment violations |

No live database, payment gateway, email provider, OAuth provider, or browser E2E environment was supplied, so those integrations were inspected and contract-tested but not exercised against real infrastructure.

## Remaining issues and release recommendation

Do not call this production-ready until frontend lint is reduced to zero and browser E2E tests cover login, checkout/payment, vendor onboarding, delivery status, and admin workflows against an isolated PostgreSQL database. Coupon pre-validation is still server-cart based while the browse cart remains local until checkout synchronization; checkout validation is authoritative, but a future cart API migration should align the pre-checkout discount display. The stale root `README.md` also describes a different Spring/Angular system and should be replaced separately; it was already user-modified, so this audit did not overwrite it.

Scores: architecture **78/100**, backend **88/100**, frontend **62/100**, integration **76/100**, maintainability **58/100**, production readiness **68/100**.

Files changed by this audit: backend configuration and broadcast route/controller files; frontend auth, cart, checkout, vendor/delivery onboarding, and admin route files; this report. Pre-existing user changes in the integration and API files were preserved.
