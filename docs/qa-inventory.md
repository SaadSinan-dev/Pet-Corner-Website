# QA inventory

| Claim / control | Functional evidence | Visual evidence |
|---|---|---|
| Arabic/RTL responsive catalog | Browser checks all routes and six widths, no horizontal overflow | Home/shop/product/cart/checkout/receipt at mobile and desktop, both themes |
| Live catalog / filters | API filtering tests; browser search, category, stock, price, sort and pagination | Populated/empty/error/skeleton states; mobile filters open |
| Cart controls and persistence | Frontend reducer tests; browser add/increment/remove/reload | Quantity controls, stale/deleted product states |
| Checkout server confirmation | Frontend failure/validation tests; browser submits and admin API reads persisted order | Field errors, submit pending, confirmed private receipt |
| Safe retry | Lost-response + exhausted inventory regression and reload recovery | Explicit prior-order recovery action |
| Private receipt | API token denial and browser reload with session token | Confirmed snapshot prices, region fee and total |
| Administrative lifecycle | Auth/create/update/upload tests; browser order visible via protected API and status changed | Swagger API docs (no dashboard application) |
| Theme and navigation | System initial preference, toggle/persistence/reload; search dialog Escape, menu and links | Light/dark pages, focus states and 320px header |
| Managed support content | Info tests render configured titles/bodies; contact/shipping from settings | Policy absent state and configured fee table |

Exploratory checks: malformed URL filter values and reversed range; stale inventory between add and checkout; missing product image; network failure and retry; direct receipt code without token; invalid product/404 route. Demo catalog is explicitly labelled everywhere through store setting; no live commercial claims are signed off.
