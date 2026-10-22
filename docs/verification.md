# Pet Corner — actual verification

Verified locally on 2026-10-21 using Windows, Node.js 24, real PostgreSQL 18, NestJS and Microsoft Edge through Playwright. Storefront: `http://127.0.0.1:5174`; API: `http://127.0.0.1:3001`. This is a local implementation and verification record, not a commercial deployment approval.

## Executed checks

| Command / check | Actual result |
| --- | --- |
| `npm test` | **37/37 passed**, four files; persistent/corrupt cart, phone validation, retry keys, failed submission retention, exact unresolved-order replay, exhausted stock/reload recovery, definitive stock rejection correction, quota/blocked browser storage, managed support content, malformed/reversed/bounded catalog filters |
| `npm --prefix api test` | **22/22 passed** against an isolated real PostgreSQL test database; also compiles API |
| `npm run test:e2e` | **5/5 passed**, final run 16.7 seconds; real catalog and order APIs, no mock order response |
| `npm run build:all` | Passed: strict storefront TypeScript + Vite production build, then API TypeScript build |
| `npm --prefix api run typecheck` | Passed |
| `npm run lint` | Passed without reported warnings; frontend, API source/scripts/seed, browser tests and configuration |
| Database migrations | Applied to development and separate test database; explicit demo seed verified as 14 illustrative products / seven nonempty categories |
| Runtime/API checks | Catalog, settings and Swagger returned 200; configured CORS preflight returned 204. Administrator CLI creation, scrypt hash and duplicate-account rejection checked without printing credentials |
| Deployment configuration | `docker compose config --quiet` passed with temporary URL-safe secret values. Sitemap generator syntax check passed |

## Real purchase evidence

The final browser run created synthetic order **PC-29ED530B6B724F** through the storefront. It searched for its temporary product, opened details, added it to the cart, changed quantity to two, reloaded to verify persistence, completed checkout with Arabic phone digits, and loaded the server-confirmed private receipt.

| Server snapshot | Value |
| --- | --- |
| Unit price / quantity | 45,678 SYP × 2 |
| Subtotal | 91,356 SYP |
| Delivery fee | 15,000 SYP |
| Total | **106,356 SYP** |
| Product stock after order | 3, down from 5 |

The protected administration API returned the same persisted order and snapshots. The test confirmed the order, reloaded the receipt and saw the updated status. Access by order code without its private token, and administrative changes without authentication, returned 401. A separate browser context could not display receipt details.

Cleanup cancelled only the test's own pre-dispatch order, verified restoration to stock 5, deactivated its temporary product and removed its temporary administrator. The cancelled synthetic order remains as history. No unrelated merchant records were reset. Ignored `test-results/` contains the latest sanitized snapshots, cleanup/viewport evidence and receipt screenshots; traces and video are disabled to avoid recording credentials/tokens.

## Responsive and visual checks

The automated browser matrix covered **60 combinations**: home, catalog, product, populated cart and checkout × Light/Dark × widths **320, 375, 390, 768, 1280, 1440**. All passed document/body overflow checks. Theme tests verified system defaults, explicit selection, reload persistence and a changed system preference.

Additional visual inspection covered desktop/mobile home, product, catalog, cart, checkout and receipt. Receipt screenshots at 390/1440 in both themes also passed overflow checks. About, contact, FAQ, shipping, privacy, terms, a category, 404, unavailable product and receipt-without-token routes were inspected at mobile width in both themes. The final 320px hero was rechecked after correcting Arabic line breaks. Real catalog request delay, failure and retry were exercised; skeleton and error views appeared correctly. No unexpected application error was observed in the exercised purchase flow; deliberate negative requests are expected to return errors.

Saved visual evidence includes [desktop home](home-desktop.png), [320px home](home-light-320.png), [mobile catalog](shop-mobile.png), [product](product-mobile.png), [cart](cart-mobile.png), [checkout](checkout-mobile.png) and [dark checkout](checkout-dark-mobile.png). These are design evidence, not commercial catalog photography.

## Review corrections

Independent review findings were fixed and rechecked: lost-response order recovery even when stock is exhausted or checkout later disabled; quantity reset between product routes; managed support titles/bodies; price filter bounds; readable-but-full browser storage; and URL-safe deployment database passwords. Regression tests cover the recovery and quota cases. Final focused independent review reported no remaining actionable findings in that scope.

## Scope and remaining launch work

| Area | Actual status / remaining work |
| --- | --- |
| Merchant data | Explicit demo catalog, illustrations, fees and regions. Replace with approved products/photos/prices/stock, policies, contacts and delivery settings before commercial launch |
| Administration | Protected REST APIs and Swagger tested. No dashboard UI exists; the brief explicitly permits API preparation when no dashboard is present |
| Payments and communications | Cash on delivery only; no online payment, SMS, email provider or courier integration |
| Deployment | Docker/Nginx/Compose files prepared; container builds and execution unverified because no Docker daemon is running. Configure HTTPS, trusted reverse proxy, backups, monitoring and actual public origin on deployment infrastructure |
| SEO / browser coverage | Client-rendered metadata and optional Product JSON-LD; no SSR/prerender. Real sitemap generation requires the actual origin and non-demo catalog. External indexing/social previews, Safari/Firefox, screen-reader audit, production load and infrastructure failover were not validated |

Cart persistence uses localStorage; pending attempts and private receipt tokens use sessionStorage, with memory fallback when writes fail. If browser storage is completely unavailable, memory survives only for the current page session. A real server receipt remains private and cannot be retrieved from the order code alone.

Setup, environment variables, administrator creation and deployment commands are in [README](../README.md); endpoint details are in [API contract](api-contract.md) and [backend guide](backend.md).
