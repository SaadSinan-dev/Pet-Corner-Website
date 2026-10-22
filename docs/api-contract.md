# Shared API contract

Base: /api/v1. JSON success bodies are direct. Paged lists use {items,total,page,limit,totalPages}. Errors are {message:string,code?:string} with safe Arabic text. A definite inventory rejection is HTTP 409 with code OUT_OF_STOCK; correct it and use a new key. Retain the unresolved checkout attempt and its key after ambiguous network failures. Money is integer currency units, configured through settings.

## Public resources

- GET /health: readiness {status:"ok"}, or 503 if PostgreSQL is unavailable.
- GET /storefront/settings: Settings below.
- GET /storefront/categories: active categories containing available public products, ordered by position then creation date.
- GET /storefront/products and /storefront/categories/:slug/products: paged Product results. Query search, category slug, minPrice, maxPrice, inStock=true|false, featured=true|false, sort=newest|price-asc|price-desc, page (default 1), limit (default 12, maximum 100). Default/newest order respects managed position, then descending creation date; explicit price order sorts by price.
- GET /storefront/products/:slug: Product.
- POST /storefront/cart/validate: {items:{productId,quantity}[]} => {items:{product:Product|null,productId,quantity}[]}. Unavailable, inactive, hidden-category or production-demo products resolve to null.

Product fields: id,name,slug,shortDescription,description,position,sku:string|null,price:number,compareAtPrice:number|null,stock:number,featured:boolean,images:{id,url,alt}[],category:{id,name,slug},createdAt. Image array order is preserved. Admin product responses additionally include active:boolean.

Category fields: id,name,slug,image:string|null,position:number,productCount:number. Admin responses additionally include active:boolean.

## Orders and recovery

POST /storefront/orders requires Idempotency-Key: UUID and body {customerName,phone,governorate,city,address,notes?:string,items:{productId,quantity}[]}. Governorate is one of دمشق، ريف دمشق، القنيطرة، درعا، السويداء، حمص، حماة، طرطوس، اللاذقية، إدلب، حلب، الرقة، دير الزور، الحسكة. No client prices, subtotal, fee or total are accepted.

Legacy requests may supply regionId instead of governorate. Existing normalized regionId payload hashes retain their exact original property ordering, so old persisted attempts recover even if checkout is now disabled or catalog/settings changed. Changed payloads under the same key return409. Legacy region fees never price a new order. New orders always persist deliveryFee:null,total:null, while historical priced orders retain their original values.

OrderReceipt: {id,orderCode,accessToken,whatsappNumber:string|null,status,customerName,phone,governorate,regionName,city,address,notes:string|null,items:{productId,name,price,quantity}[],subtotal:number,deliveryFee:number|null,total:number|null,currency,createdAt}. regionName remains for legacy clients and matches governorate on new orders. whatsappNumber is current store configuration, never a fabricated fallback. DeliveryFee zero is an explicit administrator quote, distinct from null.

GET /storefront/orders/:orderCode requires X-Order-Token from creation response. Code alone cannot retrieve a receipt. Clients keep the real receipt/token after WhatsApp opens; the API does not send WhatsApp messages. A wa.me link only prepares a customer-controlled message.

## Administrator authentication

POST /auth/login {email,password} => {accessToken}. GET /auth/me with bearer token => {id,email,role:"ADMIN"}. JWT expires after 1 hour; the account must remain active on every request. No registration or default credentials exist. Bootstrap with the protected stdin CLI described in backend.md.

Every /admin route requires bearer authentication:

- GET/POST /admin/products; GET/PATCH/DELETE /admin/products/:id.
- GET/POST /admin/categories; GET/PATCH/DELETE /admin/categories/:id. DELETE soft-deactivates.
- GET/PATCH /admin/settings.
- POST /admin/uploads: multipart file, returns {url}. Authenticated JPEG/PNG/WebP only, maximum 5 MiB, decoded/re-encoded WebP.
- GET /admin/orders?search=&status=&page=&limit=: paged receipts. Search matches orderCode/customerName/phone, case-insensitively. Status uses exact enum.
- GET /admin/orders/:id: receipt plus history:{id,orderId,status,adminId,createdAt}[] and deliveryHistory:{id,orderId,previousFee:number|null,deliveryFee,total,adminId,createdAt}[], oldest first.
- PATCH /admin/orders/:id/delivery {deliveryFee:number}: integer0–100000000. Server calculates total=subtotal+deliveryFee atomically and audits each actual change; same-fee retry creates no duplicate audit. Allowed in PENDING,CONFIRMED,PREPARING only;409 after dispatch/cancellation.
- PATCH /admin/orders/:id/status {status}: PENDING → CONFIRMED → PREPARING → OUT_FOR_DELIVERY → DELIVERED. Confirmation/preparation may proceed pending a delivery quote, but dispatch requires non-null fee/total. CANCELLED allowed in first 3 states, restores stock exactly once, and cannot reopen.

## Editable settings

Settings: storeName,currency,currencyLabel,demoMode,codEnabled,checkoutEnabled,contactPhone:string|null,contactEmail:string|null,whatsappNumber:string|null,socialLinks:{label,url}[],heroEyebrow,heroTitle,heroDescription,heroButtonText,heroImageUrl:string|null,footerText,checkoutMessage,deliveryPolicy,deliveryRegions:{id,name,fee}[],pages:Record<string,{title,body}>.

WhatsApp uses international digits without +, spaces or punctuation (7–15 digits). Social URLs require HTTPS. Hero image uses /uploads/, /images/ or HTTPS. All content is plain text. Products/categories accept a nonnegative integer position; product images are replaced and ordered by their request array. Settings PATCH is partial; only contactPhone,contactEmail,whatsappNumber,heroImageUrl accept null. To enable checkout, configure WhatsApp and nonempty deliveryPolicy and enable COD. Legacy deliveryRegions remain only for replay compatibility; their fees have no checkout effect.

Fresh databases have no products, no contact data, empty editorial content and checkout disabled. In production, explicitly marked demo products are excluded from all public catalog/cart/new-order paths. A demoMode store also disables production checkout and hides demo pages/regions from public settings; admin settings retain their editable source. No startup seed runs. /api/docs and /api/docs-json describe the service.
