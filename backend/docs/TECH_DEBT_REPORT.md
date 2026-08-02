# Technical Debt Report

Date: 2026-08-01
Scope: known, non-blocking debt carried after the integration gate.

## Frontend

| # | Debt | Impact | Recommendation |
| --- | --- | --- | --- |
| F1 | `npm run lint` ~916 pre-existing errors (mostly `prettier/prettier` + `no-explicit-any` in presentation code) | Noisy CI; masks real issues | Add Prettier format-on-save, then incrementally reduce `any` in shared types |
| F2 | Cart & wishlist are localStorage-only; backend `/cart` + `/wishlist` endpoints unused | Cart lost across devices; checkout pushes from client-side list | Sync cart to backend (`POST /cart/items`) before checkout; migrate wishlist to `/wishlist` |
| F3 | Google OAuth enabled but requires `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` env; until set, `/auth/google/url` returns 503 | Button shows an error toast until configured | Document env setup; optionally hide the button on `GOOGLE_OAUTH_NOT_CONFIGURED` |
| F4 | No frontend test harness | Regressions only caught by type-check + manual QA | Add Vitest + React Testing Library smoke suite for auth/checkout/vendor/delivery |
| F5 | `use-delivery-tracking` fixed 3s WS reconnect (no jitter/backoff) | Reconnect storm on outage | Exponential backoff + jitter |
| F6 | Heavy client libs (`recharts` ~516 kB, `framer-motion` ~384 kB) | Larger initial JS | Route-level lazy loading |
| F7 | List UIs often render full arrays despite backend pagination | Slower pages at scale | Wire `pagination` metadata into list rendering |
| F8 | `sendOTP`/`verifyOTP` client helpers unused by pages | Dead code | Remove or wire into OTP login UI |

## Backend

| # | Debt | Impact | Recommendation |
| --- | --- | --- | --- |
| B1 | WS auth gates connection by valid token only; per-room ownership checks not yet enforced | An authenticated user could open another vendor's alert stream if they know the UUID | Compare the token subject to the vendor/order owner in the upgrade handler |
| B2 | OTP/forgot-password rate limits are IP+identifier; no explicit per-account email lockout beyond the IP+email limiter | Abuse by distributed IPs | Consider account-level OTP attempt caps + anomaly alerts |
| B3 | No index audit / no coverage gate in CI | Slow queries at scale; regressions unmeasured | Add composite indexes (see DATABASE_REPORT); add `--coverage` floor |
| B4 | Jest teardown flake mitigated (`maxWorkers: 50%`, Prisma `$disconnect` in `setupFilesAfterEnv`); intermittent "worker failed to exit" warning may still appear | Noisy CI but non-failing | If it resurfaces, close the winston daily-rotate transport in the same teardown hook |
| B5 | No automated e2e against a running server (routes verified via unit/integration only) | Contract drift risk | Add a small `supertest` e2e for the top 10 customer journeys |

## Deliberate trade-offs (accepted)

- `VendorProfile` has no `subscription_plan` column; plan persisted in `Setting` JSON — fine at current scale.
- Frontend direct-calls `http://localhost:8080/api/v1` in dev; prod uses relative `/api/v1` behind `nginx.conf` — ensure CORS/nginx proxy config ships with the deployment.
