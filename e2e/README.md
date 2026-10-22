# Isolated browser verification

Run `npm run test:e2e` from the project root with PostgreSQL reachable through api/.env DATABASE_URL (or explicit environment). The role needs CREATEDB permission. Install root, API and admin dependencies first.

scripts/test-browser.mjs creates a unique UTF-8 pet_corner_browser_<time>_<random>_test database, applies both migrations, seeds synthetic inventory and starts isolated API/store/admin services on 3002/5176/5177. Temporary secrets and credentials are generated in memory. Merchant/local records are never modified. The database is retained for inspection, not automatically dropped. Screenshots and synthetic evidence live in ignored test-results/. Trace/video recording is off to avoid recording credentials or receipt tokens.

On Windows the config uses installed Edge. Override PLAYWRIGHT_EXECUTABLE_PATH or install Playwright Chromium elsewhere. Direct invocation without the wrapper's isolated database marker is rejected.

Five serial scenarios:

1. Admin UI settings, category/product creation, two actual image uploads and reordering; storefront purchase; first order response lost after persistence; exact retry restores one order and one stock deduction; receipt privacy; prepared WhatsApp URL only; admin delivery quote/status and persisted history.
2. Hold main module to inspect pre-React splash, 8-second failure escape and subsequent dismissal, reduced motion, light default despite dark OS, saved theme, keyboard/backdrop drawer dismissal, navigation and favicon.
3. Real catalog requests: skeleton, empty search, sorting, pagination where available, category/price filters, invalid range, network failure and retry.
4. Fourteen storefront routes including populated cart/checkout/receipt and 404: nine widths in both themes = 252 overflow checks.
5. Admin login (18 checks), loading/error/retry, drawer, ten authenticated routes (180 checks), logout and theme persistence. Combined total: 450 viewport/theme/route checks. Tables may scroll inside bounded containers.

Widths: 320, 360, 375, 390, 430, 768, 1024, 1280, 1440. Screenshots cover 320/768/1440 in both themes; assertions cover all nine widths. Automated fit checks are not a full accessibility audit or cross-browser certification. See the dated verification report for actual results and visual review.

Cross-origin deployment regression: the isolated wrapper now gives both frontends an absolute API base on port 3002. Requests bypass the frontend development proxy, exercising real browser CORS. The product scenario verifies uploaded WebP is loaded from the API origin with a nonzero natural image width, then reloads and checks it again. It still never contacts a public deployment.
