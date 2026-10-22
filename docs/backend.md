# Pet Corner API

The independent api/ service uses NestJS 11, TypeScript, Prisma 6 and real PostgreSQL. It shares the API contract with the separate storefront and admin applications; integration of their user interfaces is verified separately by the parent task.

## Setup and environment

From api/, install dependencies, copy .env.example to .env, then run npm run db:generate, npm run db:migrate and npm run build. Start with npm run dev locally or npm start after building. The local helper npm run db:dev starts a persistent real PostgreSQL cluster on 127.0.0.1:54329 without resetting store data; it creates separate petcorner and petcorner_test databases. Production requires a separately maintained PostgreSQL server.

Required configuration: DATABASE_URL (PostgreSQL), JWT_SECRET and ORDER_TOKEN_SECRET (independent random secrets, at least 32 characters). Keep ORDER_TOKEN_SECRET stable to preserve receipt links. PORT defaults 3001 and must be 1–65535; HOST defaults 127.0.0.1. NODE_ENV accepts development,test,production. CORS_ORIGINS contains exact comma-separated HTTP(S) origins; localhost/127.0.0.1 ports 5174 and 5175 are development defaults. APP_PUBLIC_URL and ADMIN_PUBLIC_URL are optional locally, required in production, and their origins must appear in the CORS allowlist. Production requires explicit CORS_ORIGINS. A frontend deployment may use different origins through those variables.

Only STORAGE_PROVIDER=local is implemented. UPLOAD_DIR defaults ./uploads and must be persistent/writable by the API user. PUBLIC_UPLOAD_BASE_URL defaults /uploads or may be a public HTTPS URL. With separate storefront/admin origins, configure an absolute HTTPS uploads URL served by the API/proxy so images resolve in either application. Setting an external URL does not provision storage or a CDN. No secrets belong in Vite variables.

## Safe migrations and demo separation

Both tracked migrations are retained. 20261022010000_production_upgrade adds editable content, product/category positions, explicit product isDemo metadata, governorate and delivery audit history. Historical fees/totals are preserved; only new orders begin with null fee/total. The database enforces paired nulls or a nonnegative fee and total=subtotal+fee. No reset/drop-data step exists.

The additive migration marks only the 14 known original demo records whose slug, DEMO SKU and explicit demo description agree. These remain visible locally. Production excludes isDemo products from list/detail/category/cart/new-order paths, and demoMode disables checkout and suppresses public demo pages/regions. Existing inactive browser fixtures stay inactive. New production databases remain empty with checkout disabled. npm run db:seed remains explicit, development-only, and marks created products isDemo; never seed production. Do not convert sample inventory into commercial inventory merely by removing its label; create real products with real prices/images/content.

Before commercial orders, configure real WhatsApp international digits, deliveryPolicy and COD, then enable checkout and disable demoMode. deliveryRegions remain stored only to support exact recovery of old requests; no new order uses a preset regional fee.

## First administrator and API

No administrator/default password is auto-created. Supply a unique 14–256 character password through a password manager or hidden terminal prompt to stdin of node dist/scripts/create-admin.js admin@example.com. The CLI refuses existing accounts, hashes with scrypt and never prints a password. Do not put passwords into process arguments or shell history. POST /api/v1/auth/login returns a one-hour bearer JWT; GET /api/v1/auth/me validates it against the still-active account.

See [the shared contract](api-contract.md) for exact routes and types, or /api/docs and /api/docs-json for Swagger. All /admin endpoints require the server-side administrator guard. Product/category deletion soft-deactivates; image ordering follows the supplied array and product/category positions control catalog ordering. Orders support search/status/pagination; detail includes immutable product/price snapshots plus status and delivery audit history. Settings are persisted in PostgreSQL and returned through public settings for actual storefront consumption.

## Delivery, inventory and recovery

Order creation reads current server prices, snapshots item names/prices/currency/address, decrements inventory conditionally and saves everything in one serializable transaction. New orders save only subtotal; deliveryFee and total remain null. Normalized payload hashes and unique UUID idempotency keys return one saved order under identical retries, including pre-upgrade regionId payloads after checkout/catalog changes. Different payloads under the same key conflict. Multi-item failures roll back stock updates. Private HMAC receipt tokens are required separately from order codes.

Administrators quote delivery using PATCH /api/v1/admin/orders/:id/delivery {deliveryFee}. The same transaction computes final total and records previous/new fees, administrator ID and time. A zero quote is explicit free delivery. Quotes may change before dispatch; changing after dispatch/cancellation is rejected. Confirmation and preparation can occur while a quote is pending; dispatch cannot. Status chain is PENDING → CONFIRMED → PREPARING → OUT_FOR_DELIVERY → DELIVERED; cancellation in the first 3 states restores stock exactly once, including concurrent cancellations.

WhatsApp is a configured customer-opened prepared-message link. No Business API, automatic sending or delivery webhook is claimed. Closing WhatsApp cannot delete a saved order. No online payment gateway is connected.

## Uploads and operational safeguards

Strict DTO validation rejects unknown fields, client prices, invalid governorates, negative/fractional money and invalid quantities. Body size limits, Helmet, explicit CORS, general request throttling and stricter login throttling are enabled. Safe Arabic errors hide stack/database details. Bearer tokens belong in admin memory. Forwarded client IP headers are not trusted automatically; configure proxy trust/infrastructure limits for the actual deployment topology.

Uploads require authentication, a single 5 MiB JPEG/PNG/WebP and at most 16 million decoded pixels; animated/invalid images are rejected. The API rotates/resizes, strips metadata, re-encodes WebP and generates filenames. SVG/arbitrary files are refused. Local storage needs persistent backups. Implement another StorageAdapter before choosing any other provider.

GET /api/v1/health checks PostgreSQL readiness and returns 200 {status:"ok"} or 503. Run migrations before starting a new version. Back up PostgreSQL and uploads, restrict API network access, terminate HTTPS at a maintained proxy and configure correct public URLs/origins. Docker execution and external HTTPS/storage deployment are outside this API verification and are not claimed as completed.

## Verification record — 2026-10-22

Applied the additive migration successfully to existing development petcorner and isolated petcorner_test. Read-only post-migration check retained 19 products and 6 historical orders, with exactly 14 original seed products identified as demo; the remaining 5 browser fixtures were already inactive. No production/local store reset or seed rerun occurred.

The original 22 integration risk tests were retained with revised shipping expectations; additional tests cover governorate/null quote, quote permissions/validation/audit/dispatch guard, settings/ordering/search/identity/readiness, exact old payload replay, production demo exclusion, database paired-null constraints and concurrent quoting. The latest completed run passed 28/28 tests (27 PostgreSQL integration tests plus configuration validation). Typecheck/build passed. Configuration validation passed as part of that run.

Integration tests require TEST_DATABASE_URL to a dedicated database whose name ends in _test and clear fixtures only there. Run npm run db:migrate:test then npm test; npm run typecheck and npm run build verify compilation. Never point TEST_DATABASE_URL at store data. Tests must run serially to avoid sharing fixture resets.

Windows note: Prisma generation updates client JS/types, but replacing an engine DLL loaded by a live API process can produce EPERM. The unchanged Prisma 6.19 engine successfully ran migration/integration checks; stop the API, run npm run db:generate, then restart to complete generation cleanly. The backend agent did not stop or restart the live service.

