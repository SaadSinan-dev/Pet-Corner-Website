# Pet Corner Admin

An independent Arabic RTL administration application. Node 22.12+ is required.

```sh
npm install
cp .env.example .env
npm run dev
```

The development server runs on port 5175. Requests to `/api` and `/uploads` are proxied to the existing Nest API on port 3001. Production builds are served independently from `dist/` with SPA fallback to `index.html`.

`VITE_ADMIN_API_BASE_URL` defaults to `/api/v1`. For separate origins set the complete API base URL and allow the admin origin in API `CORS_ORIGINS`. Production uploads return public Supabase Storage URLs; its server key stays inside the API. `PUBLIC_UPLOAD_BASE_URL` applies only to local development storage. `VITE_STOREFRONT_URL` controls the visit-store link. `VITE_ADMIN_SITE_URL` documents the intended admin origin. Vite variables are public; never put secrets in them. See [the free hosting guide](../docs/free-hosting.md) for the current production setup.

An active administrator must already have been provisioned through the API's secure administrator creation script. There are no built-in credentials. Login exchanges credentials at `/auth/login` and verifies `/auth/me`. The bearer token stays in memory: reload and logout require login again. Expired sessions clear cached administrative data.

Routes: `/login`, `/products`, `/products/new`, `/products/:id`, `/categories`, `/categories/new`, `/categories/:id`, `/orders`, `/orders/:id`, `/settings`. Catalog deletion disables records without removing historical orders. Upload supports JPEG, PNG and WebP up to 5 MiB and keeps image order. Delivery stays unknown until its fee is saved; the API computes the final total. WhatsApp links prepare drafts only.

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

Settings expose existing real API fields only. Checkout can be enabled only with cash on delivery, a configured WhatsApp number and a delivery policy. Theme defaults to light, and the user's choice is persisted separately from storefront settings.
