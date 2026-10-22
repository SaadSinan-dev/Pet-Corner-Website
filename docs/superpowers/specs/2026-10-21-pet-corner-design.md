# Pet Corner implementation design

The supplied Arabic product brief is the approved scope and explicitly requests continuous implementation without unnecessary approval gates. This is an architectural project. The existing app is an unmodified React/Vite starter, no git repository, no dashboard, backend, database, environment or product assets. Preserve the root storefront and add an independently runnable `api/` NestJS service.

## Architecture and decisions
- React 19, strict TypeScript, Vite, Tailwind, Router, TanStack Query, React Hook Form and Zod. Root owns UI and browser tests. API owns Prisma/PostgreSQL and integration tests. API contract is `docs/api-contract.md`.
- Real PostgreSQL locally (embedded development server if Docker unavailable); Docker Compose for portable deployment. No in-memory production fallback. Development catalog is explicitly marked demo, seeded only by an explicit command, never automatically in production.
- No existing dashboard: deliver protected admin APIs and Swagger, not an invented dashboard integration. JWT administrator authentication, hashed passwords, CLI bootstrap, server-side validation and authorization.
- Store settings own currency, delivery regions, fees, COD switch, contact details and support content. Production checkout disabled until explicit delivery configuration; demo seed includes explicit demo delivery regions and prices.
- Storefront prices are indicative; order transaction reads database prices, snapshots items, atomically decrements stock and uses a unique idempotency key plus payload match. Cancellation restores inventory once. Order receipt is accessible through a secret token, not code alone.

## Visual design
Use inspected logo's navy #103f6b, blue #2c75c8, warm ivory surfaces, editorial Arabic typography (self-hosted IBM Plex Sans Arabic), restrained terracotta accent. Home has an asymmetric navy/ivory hero, an editorial photograph of a dog and cat, genuine database categories, featured product grid and two distinct pet shopping panels. No fake reviews, sales badges or made-up delivery promises. Dedicated dark tokens, RTL logical spacing, mobile layouts and reduced motion.

## Features and states
Home, shop with URL-backed search/filter/sort/pagination, category, product gallery, persistent cart revalidated against API, checkout, private receipt, about/contact/FAQ/shipping/privacy/terms and 404. All remote data have real skeleton/error/empty states. Local cart stores IDs and quantities only. Form stays intact on failure; receipt and cart clear only after confirmed API success. Every primary control works and has accessible labels and visible keyboard focus.

## Verification
Typecheck, lint, frontend state/form tests, Nest API tests with real PostgreSQL, production builds and browser purchase flow. Check widths 320/375/390/768/1280/1440, light/dark, RTL, request failures, unauthorized mutations, overselling, duplicate submissions, stale cart and secure receipt. Record actual results and limitations in docs/verification.md. Do not claim publication or a dashboard UI.
