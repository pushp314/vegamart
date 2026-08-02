# Performance Report

Date: 2026-08-01

## Backend

| Area | Status | Notes |
| --- | --- | --- |
| Response caching | In use | `cacheService.remember` / `invalidateNamespace` on vendor and product list lookups; invalidated on mutation |
| WebSocket realtime | In use | Single `WebSocketServer` on `/api/v1`, room-based fan-out (roaming, per-vendor alerts, per-order delivery stream); 30s heartbeat + dead-client reaping |
| Pagination | In use | `buildPaginationMeta` on list endpoints (admin, orders, products); frontend reads `pagination` when present |
| Decimal handling | In use | Prisma `Decimal` converted to JS numbers before response (totals, earnings) |
| N+1 / query shape | Not fully audited | Parallelized the heaviest path in `getDeliveryTracking` (`Promise.all` of tracking/address/vendor); recommend an index audit (see DATABASE_REPORT) |

### Build / runtime signals
- `npm run build` clean; jest full suite ~36 suites completes (integration suites up to ~34s in the flaky run; standalone runs faster).
- Two transient test failures were worker teardown / open-DB-handle noise, not latency or correctness defects.

## Frontend

| Metric | Value |
| --- | --- |
| Production build (Nitro) | ~1.1 s; three server SSR bundles emitted |
| Largest libs | `@tanstack/react-router` ~659 kB, `recharts` ~516 kB, `framer-motion` ~384 kB (pre-gzip; gzip ~138 kB / ~96 kB / ~100 kB) |
| Data fetching | TanStack Query with cache keys + `invalidateQueries` on mutation; enables refetch dedup |

### Recommendations
1. **Route-level code splitting** for the heavy admin/vendor portals — several large chunks (e.g. `admin-*.mjs` ~86 kB SSR) are emitted; confirm client bundling splits by route.
2. **WS reconnect jitter**: `use-delivery-tracking` reconnects on a fixed 3s timer; add exponential backoff + jitter to avoid thundering herd on brief outages.
3. **Bundle budget**: consider lazy-loading `recharts` and `framer-motion` (only used on analytics/animations) to cut initial JS.
4. Add real pagination to frontend list UIs that currently load full arrays (noted where `pagination` is returned but the UI renders the whole list).
