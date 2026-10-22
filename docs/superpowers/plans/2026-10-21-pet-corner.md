# Pet Corner Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development for independent implementation and review. Steps use checkbox syntax for tracking.

**Goal:** Implement the supplied Pet Corner Arabic commerce brief in the existing workspace.
**Architecture:** Existing root storefront plus `api/` NestJS service and PostgreSQL; independent modules share a documented API contract.
**Tech Stack:** React, TypeScript, Vite, Tailwind, Router, Query, RHF/Zod, NestJS, Prisma/PostgreSQL.
**Spec:** ../specs/2026-10-21-pet-corner-design.md

## Global Constraints
Arabic default, `lang="ar" dir="rtl"`; no fabricated commercial claims; database is authoritative; no insecure admin shortcut; explicit demo seed; never reset existing data; keep secrets out of tracked files.

## Review Focus
Concurrency and idempotency; stale/deleted cart products; failed order submission; delivery fees unknown; private receipts and admin authorization. Include adversarial checks for these in API/browser tests.

## Task 1 — Database and API
- [x] Implement api/ schema, migrations, seed, settings, auth, storefront/catalog/order/admin/upload modules and Swagger against docs/api-contract.md.
- [x] Write and run tests for invalid inputs, authorization, server pricing, inventory concurrency, idempotent replay, cancellation and receipt privacy.
- [x] Run PostgreSQL, migrate, explicitly seed demo, verify API build and tests; document commands and environment.

## Task 2 — Storefront foundation and catalog
- [x] Create src/lib/types.ts and api.ts contract clients, reusable states/product cards and semantic design tokens.
- [x] Build shell, home, product/category/shop, filters, support routes, SEO, theme persistence and mobile navigation.
- [x] Produce self-hosted imagery/font and optimized logo; document demo imagery.
- [x] Verify catalog, route/filter behavior, skeleton/error/empty views and production build.

## Task 3 — Cart and checkout
- [x] Write failing tests for persistent ID/quantity cart, validation, server-confirmed order flow and failed submission retention.
- [x] Implement src/lib/cart.tsx, src/pages/Commerce.tsx, protected receipt and idempotent submissions.
- [x] Verify against live API; finish responsive light/dark styling with shared tokens.

## Task 4 — Integrated QA and delivery
- [x] Run lint, strict typecheck, tests, builds, full browser purchase and administrative order lifecycle.
- [x] Inspect all required viewport widths, RTL, themes, error paths and console/network errors; fix failures.
- [x] Write setup/run/deployment README, API guide and actual verification record. Request independent code review and resolve actionable findings.

## Progress
Implementation, integrated verification, independent review and documentation: complete. Local commercial-data and deployment limits are recorded in docs/verification.md. No git metadata exists, so commits/worktrees are inapplicable; files are edited in the explicitly requested directory. User explicitly requests an engineering team and uninterrupted implementation; independent agents own non-overlapping directories/files.
