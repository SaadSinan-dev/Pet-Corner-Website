# Production upgrade implementation plan

Spec: ../specs/2026-10-22-production-upgrade-design.md
Global constraints: preserve data and migrations; real APIs; no invented commercial data; independent admin; default light; nullable delivery/total; exact pending replay; no WhatsApp auto-send; no secrets in browser bundles.

- [x] 1. API: additive schema/migration, nullable quoted delivery, governorate compatibility, settings, ordering/search/auth health and production demo guard. Tests and contract updates. Owner backend agent: api/ plus docs/backend.md and docs/api-contract.md.
- [x] 2. Admin: independent admin/ application, protected session, product/category/image ordering CRUD, order search/details/quote/status, settings with actual storefront effects; RTL themes/responsive and tests. Owner admin agent: admin/ only.
- [x] 3. Commerce: shared frontend types, governorate checkout, null delivery/total receipt, configured WhatsApp composer, replay compatibility and tests. Owner commerce agent: src/pages/Commerce.tsx, commerce.css, src/lib/types.ts, checkout.ts, whatsapp.ts and relevant tests.
- [x] 4. Storefront: original-logo splash/favicon, light theme, RTL drawer, managed Hero/footer/policies, visible visual refinements, skeleton/error states. Owner root: all remaining storefront files and visual verification.
- [x] 5. Integration: run all tests/build/lint, upgrade browser tests both apps and nine widths, review, deploy configs/health/backups/env and documentation. Owner root after agents, independent review.

## Ledger
Ruling: implement directly from comprehensive supplied brief rather than pause for design approval — explicit user instruction — reversible implementation is authorized.
Ruling: retain root app/api paths and add admin/ — avoids disruptive moves and duplicated systems — all three builds remain independent.
No Git repository exists; isolated worktrees/commit diff packaging are inapplicable. Files remain in requested workspace; reviewers inspect scoped source and report evidence.

| Pair/task | Interface or consistency check | Resolution |
| --- | --- | --- |
| API/admin/commerce | API field names, null totals, settings and quote endpoint | Defined in spec before delegation; changes communicated across agents |
| Admin/storefront | Shared settings consumed by actual storefront | Root handles all Hero/footer/social/policy consumption |
| Commerce/storefront | Shared types, styling | Commerce owns types/commerce.css; root owns index.css |
| 1 | Additive migration vs preserve history | Existing totals unchanged; nullable columns only |
| 2 | Independent app vs source reuse | Separate admin manifest/routes/build; API shared |
| 3 | Revised governorate vs existing stored retries | Preserve legacy payload replay support |
| 4 | Initial splash vs no artificial delay | Dismiss on app shell ready; bounded failure escape |
| 5 | Test fixtures vs production records | Dedicated test DB; E2E changes only uniquely tagged fixtures |

Final evidence: docs/verification-2026-10-22.md. All five implementation stages completed. Final independent review agent was unavailable because of the account usage limit; root source review and fresh automated/browser checks completed. External Docker/HTTPS/backup restore execution remains explicitly unverified and is documented.
