# Test Coverage Report

Date: 2026-08-01

## Backend — Jest

| Metric | Value |
| --- | --- |
| Test suites | 36 passed / 36 total |
| Tests | 340 passed / 340 total |
| TypeScript (`npx tsc --noEmit`) | Clean |
| Build (`npm run build`) | Clean |

Area coverage:

- **Unit (28 suites):** cache, vendor-location, admin-vendor, settings, category, payment, report, job-tasks, security middleware, file-validation, auth validators, admin-delivery, order, pagination, upload, wishlist, coupon, checkout, admin-user, cart, and more.
- **Integration (8 suites):** app boot, auth routes, marketplace routes, commerce routes, phase5 routes, phase6 routes, health/metrics, integration alias routes (41 tests).

Note: a single full-suite run previously reported 2 flaky failures (worker teardown / open-database-handle noise). Mitigations added — `maxWorkers: "50%"`, `testTimeout: 60000`, and a `tests/setup-after-env.ts` hook that disconnects Prisma after each suite. Subsequent full runs are clean (340/340). The commerce suite (13/13) and the integration suite (41/41) pass standalone.

## Frontend — gali-connect-main

| Metric | Value |
| --- | --- |
| TypeScript (`npx tsc --noEmit`) | Clean |
| Production build (`npm run build`, Nitro) | Clean (~1.1 s build, 3 generated server bundles) |
| Lint (`npm run lint`) | Not clean — ~916 pre-existing errors (see TECH_DEBT) |

The frontend has no unit-test harness; verification is via type-checking, production build, and runtime spot-checks of every integration-critical flow.

## Coverage recommendation

- Add a frontend test runner (Vitest + React Testing Library) with smoke tests for the auth, checkout, vendor, and delivery portals.
- Add backend `--coverage` to CI and enforce a floor (e.g. ≥80% lines) once suites are stable; currently there is no coverage gate.
