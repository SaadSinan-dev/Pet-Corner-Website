# Free hosting implementation plan

User brief: e08bfbdb-4901-4ae9-8e2c-c2220502979d. Execute locally now; no external account creation or paid resources. Existing applications/data/migrations remain in place.

Architecture: two independent Cloudflare Pages Git projects; one Render Free Docker API; Supabase Free PostgreSQL and public-read product bucket. Server-side storage adapter uses authenticated Supabase REST operations; local storage only outside production. Never expose service credentials in Vite/CI artifacts. Preserve soft deletion and historical image links; no automatic deletion on product deactivation.

- [x] 1. Add failing storage/config tests, implement Supabase adapter, strict production validation and bounded provider failures; keep sanitized WebP upload contract.
- [x] 2. Separate runtime DATABASE_URL and DIRECT_URL migration subprocess. Preserve all migrations and serializable inventory/idempotency; isolate every test URL. Add legacy /uploads redirect and explicit non-destructive transfer utility retaining object names.
- [x] 3. Replace paid Render resources with Free web service only, revise production/local examples, CI and Compose compatibility; document Supabase pooler session/transaction choices and server-only bucket privileges.
- [x] 4. Verify API/storage failures, app/UI upload/cart/order flow, lint/types/build; write actual-results report and short owner setup guide with free-tier limits and cloud verification steps.

Verification: tests use synthetic credentials, temporary files, isolated PostgreSQL and local HTTP storage fixture only. No live Supabase claims until the owner runs the documented external acceptance. Actual cloud quotas/limitations verified from official documentation on 2026-10-22. Native Git CI remains the merge/deploy gate; no credential-bearing production requests from CI.

Ruling: use native fetch against documented Supabase Storage REST API, retaining provider-neutral put/remove/publicUrl interface and no new application SDK dependency. Production validates cloud variables, rejects local storage, and returns no upload URL unless public retrieval is confirmed. Migration commands use DIRECT_URL with session/direct connection, never transaction pooling. Old local files require one explicit owner copy; no bytes or records deleted during transfer.

Completed locally: storefront71 + admin13 + API45 + deployment10 =139 passing tests, plus5 passing browser tests/450 viewport checks. All3 builds and lint/type checks pass. Reviewer findings fixed with narrow HTTP400 missing-object handling, a separate additive RLS migration protecting Prisma metadata, and corrected environment guidance; focused re-review found no remaining important issues. No external accounts/resources, live Supabase validation, actual hosted redeploy or backup/restore are claimed. Owner setup and acceptance are in docs/free-hosting.md; evidence/results are in docs/verification-free-hosting-2026-10-22.md.
