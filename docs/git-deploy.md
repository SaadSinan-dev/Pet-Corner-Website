# Git deployment setup

This repository prepares two independent Cloudflare Pages applications and one Render Docker API with managed PostgreSQL and persistent image storage. No Git remote, hosting project, account, public URL, database or administrator is created by these files. The owner must connect the services and enter their actual environment values. Production branch is `main` everywhere.

## 1. Connect the repository and protect main

Create or choose the GitHub repository, review the files to be committed, and push the project with all three lockfiles. Keep `.env` files, uploads, backups, local databases, test results and credentials out of Git. This directory originally had no Git metadata; this task does not create a remote or push.

The workflow `.github/workflows/ci.yml` runs on pull requests to `main`, pushes to `main`, and manual dispatch. Its stable required job/check name is **Quality checks**. After its first run, configure a GitHub ruleset or branch protection for `main` to:

1. Require a pull request and the **Quality checks** check before merge.
2. Require the branch to be up to date with `main` before merge.
3. Block force pushes and direct pushes, including administrator bypasses as appropriate for the repository owner.

The workflow uses Node 24, installs the root/admin/API lockfiles, checks lint/types/builds, runs deployment guard tests, frontend/admin tests, PostgreSQL integration tests and the isolated Chromium commerce flow. PostgreSQL is a disposable CI service; the API suite uses `petcorner_ci_test`, and the browser wrapper creates another uniquely named `_test` database. Its service user has the database-creation permission required by the wrapper. No production secrets are needed in GitHub Actions.

Only screenshots and the three explicitly named safe evidence JSON files are retained for seven days. Traces, videos, environment files, credentials, uploaded image directories and databases are not uploaded. The isolated browser suite deliberately refuses production endpoints; keep those safeguards.

## 2. Configure two Cloudflare Pages Git projects

Connect both Pages projects to the same repository through Cloudflare's native Git integration. Use a custom/no-framework preset so the following values are retained. Both projects build from the repository root; do not set the admin project's root directory to `admin`.

| Setting | Storefront project | Admin project |
| --- | --- | --- |
| Production branch | `main` | `main` |
| Root directory | Repository root (leave empty) | Repository root (leave empty) |
| Build command | `npm run pages:build:storefront` | `npm run pages:build:admin` |
| Build output directory | `dist` | `admin/dist` |
| `NODE_VERSION` | `24` | `24` |
| `VITE_API_BASE_URL` | Actual public API origin plus `/api/v1` | Not used |
| `VITE_ADMIN_API_BASE_URL` | Not used | Actual public API origin plus `/api/v1` |
| `VITE_SITE_URL` | Actual storefront HTTPS origin | Not used |
| `VITE_ADMIN_SITE_URL` | Not used | Actual admin HTTPS origin |
| `VITE_STOREFRONT_URL` | Not used | Actual storefront HTTPS origin |

Set these in each project's **Production** environment. All `VITE_` values are public and embedded at build time: enter no passwords, database URLs, signing secrets or private tokens. Rebuild when a public URL changes. The checked build commands reject missing, insecure or local production URLs and run that application's tests, lint, type checks and build. The admin command must install the admin package as well as the root package because the checkout root is shared.

Pages runs its own build independently after a Git push. Native Pages integration does **not** automatically wait for every unrelated GitHub check. The full-repository production merge gate is the protected `main` branch and required **Quality checks** job. A successful per-app Pages build is a second gate for that frontend. Render has its own CI-waiting setting described below. There can be a period in which the frontend and API use different revisions, so deploy compatible API changes and review schema changes before merging.

Initially disable automatic preview branch deployments. To enable previews later, use separate staging API/data, accurate preview environment URLs and an explicit staging CORS allowlist; production does not allow arbitrary preview origins. Do not send preview orders to production data.

Only publish the configured output directory. Verify that `_headers` and `deployment.json` are present and a top-level `404.html` is absent. Open a product URL directly and refresh `/checkout`; for admin, open `/orders` directly and confirm the login screen loads. A successful homepage request alone does not verify SPA fallback. The admin app keeps tokens in memory and requires a new login after a full reload.

See Cloudflare's [Git integration](https://developers.cloudflare.com/pages/configuration/git-integration/) and [build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/) for the corresponding dashboard settings.

## 3. Prepare Render API, PostgreSQL and uploads

Review `render.yaml` before importing it through a **connected Git provider**. It is a Blueprint for paid resources: one small Docker web service, one small managed PostgreSQL instance in the same region, and a 1 GB persistent image disk. Confirm current costs, capacity and region before creation. Service/database names are proposed configuration names, not evidence that resources already exist. Connecting to an existing production database requires a separately reviewed migration/import plan; this Blueprint creates a new database and does not copy local store data.

The API service uses `main`, `rootDir: api`, Dockerfile `./Dockerfile`, Docker context `.`, `npm run start:production`, and readiness path `/api/v1/health`. Render resolves the Docker paths relative to the configured root directory. `DATABASE_URL` comes from the managed database's private connection string; public PostgreSQL access is disabled by `ipAllowList: []`. `JWT_SECRET` and `ORDER_TOKEN_SECRET` are generated by Render. Preserve both across routine deploys, especially `ORDER_TOKEN_SECRET`, which signs existing receipt access tokens.

Enter the prompted values in Render without committing them:

| Variable | Value to enter |
| --- | --- |
| `APP_PUBLIC_URL` | Actual storefront HTTPS origin, without a path or trailing slash |
| `ADMIN_PUBLIC_URL` | Actual admin HTTPS origin, without a path or trailing slash |
| `CORS_ORIGINS` | Those two exact HTTPS origins separated by a comma, without trailing slashes or wildcard |
| `PUBLIC_UPLOAD_BASE_URL` | Actual API HTTPS origin plus `/uploads` |
| `TRUST_PROXY` | `false` or `0` by default; use an integer `1`–`5` only after confirming the proxy hop count for this deployment |

The Blueprint also sets `NODE_ENV=production`, `HOST=0.0.0.0`, `PORT=10000`, `STORAGE_PROVIDER=local` and `UPLOAD_DIR=/app/uploads`. Check disk ownership/writability through the first authenticated image upload. Both frontends use absolute API URLs; changing a public uploads URL does not itself create storage or a CDN. The implemented provider stores WebP files on the mounted disk and serves them from the API. No R2/S3 adapter is claimed.

`autoDeployTrigger: checksPass` makes Render wait for the commit's repository CI checks before auto-deploying. Use the connected repository integration; public-repository-URL services do not support this automatic flow. In Render, verify **After CI Checks Pass** remains selected. Render accepts GitHub check conclusions of success, neutral or skipped and does not deploy if it detects no checks, so do not add conditions that skip the required quality job. Manual deploys, first creation and environment/configuration changes still require operator review; the setting is not a backup or migration approval system.

Before starting the API, `start:production` validates production configuration and applies the checked-in Prisma migrations with `migrate deploy`. It does not seed, reset or delete data. A migration failure prevents startup. The database-readiness endpoint must return 200 before treating a deployment as live. Do not replace this command with a seed command or a test database command.

Render's current [Blueprint reference](https://render.com/docs/blueprint-spec), [monorepo path rules](https://render.com/docs/monorepo-support), and [CI deploy behavior](https://render.com/docs/deploys#integrating-with-ci) describe these settings. Validate the Blueprint against [Render's published JSON schema](https://render.com/schema/render.yaml.json) and review the import preview before creating resources.

## 4. Persistence, backups and schema releases

Only `/app/uploads` is persistent for API files. Render preserves files under the attached disk across process restarts and redeploys; other container paths are ephemeral. A disk is available to one service instance at runtime, so this configuration intentionally uses one instance. Disk-backed deploys interrupt the API while the instance is replaced. The disk is unavailable during builds, pre-deploy commands and separate one-off jobs. These are platform limits, not zero-downtime or multi-region guarantees. See [Render persistent disks](https://render.com/docs/disks).

Before merging a major/schema-changing release to the auto-deployed branch, obtain a verified PostgreSQL backup and a matching upload archive, retain an encrypted off-host copy, and test restoration in a separate database/directory. Backups contain customer data and belong outside Git and Actions artifacts. Use managed database backups or a reviewed `pg_dump` against the explicitly selected database. Export uploads from the running disk-backed service over an authenticated transfer; a one-off job cannot read this disk. Document the chosen restore point and maintenance window before allowing the merge. Builds and startup do not manufacture a successful backup record.

`scripts/backup.ps1` targets the existing Docker Compose deployment with its explicitly selected environment file. It is not a Render backup command. Do not run it assuming it backs up managed Render resources. Render disk snapshots complement an off-host backup, but they do not replace a verified database-and-uploads recovery plan. Never run reset, seed or fixture cleanup against the production database.

## 5. Owner acceptance after connecting services

1. Confirm **Quality checks** passes on the deployed commit and that both Pages deployments and the API show the intended revision. Check API readiness, direct frontend routes and cross-origin requests. Run `npm run verify:public -- --store=https://REAL_STORE --admin=https://REAL_ADMIN --api=https://REAL_API/api/v1 --revision=COMMIT_SHA` after replacing all placeholders with actual public URLs and the exact commit SHA; use `npm run verify:public -- --help` for its contract. This utility is read-only; it is not run in CI against guessed hosts.
2. Create the real administrator in the deployed API using the existing `node dist/scripts/create-admin.js YOUR_ACTUAL_EMAIL` command and a unique password supplied through stdin from a hidden prompt or password manager. The command refuses existing accounts. Do not put a password into an argument, source file, Actions secret for this CI, browser evidence or chat transcript.
3. Log into the public admin UI, add the store's approved product/category content and upload a real image. Confirm the image loads on its product page, category/hero where used, and in admin. Restart/redeploy the API and confirm the same uploaded image and database product remain available.
4. Configure the actual business WhatsApp number, delivery policy, COD and checkout settings, with demo mode disabled. No commercial contact details or account credentials are invented by this repository. Production hides identified demo products and refuses demo seeding.
5. Run a consciously authorized public test order through the storefront, confirm exactly one saved order and stock decrement, then quote delivery and update status in admin. Check the customer's receipt reflects the quote; cancel the marked test order through the supported workflow if appropriate. This step mutates production and is separate from the read-only smoke tool. Existing isolated E2E tests must not be redirected to production.

Until these owner steps are completed, the repository is prepared for Git deployment; public deployment, a real admin account, durable hosted uploads and a live purchase test are not claimed as completed.

## Variable placement

| Location | Variables and purpose |
| --- | --- |
| Local root/admin `.env` | Development VITE API/site URLs; local proxy defaults work only locally. `.env.production.example` in each app documents checked Pages builds. |
| Storefront Pages Production | NODE_VERSION=24, VITE_API_BASE_URL (HTTPS API + /api/v1), VITE_SITE_URL (actual shop origin). |
| Admin Pages Production | NODE_VERSION=24, VITE_ADMIN_API_BASE_URL (same API), VITE_ADMIN_SITE_URL (admin origin), VITE_STOREFRONT_URL (shop origin). |
| Backend hosting | DATABASE_URL, JWT_SECRET, ORDER_TOKEN_SECRET (secrets); NODE_ENV=production, HOST=0.0.0.0, PORT, exact CORS_ORIGINS/APP_PUBLIC_URL/ADMIN_PUBLIC_URL, STORAGE_PROVIDER=local, absolute UPLOAD_DIR, PUBLIC_UPLOAD_BASE_URL=https://API/uploads, verified TRUST_PROXY. See api/.env.production.example. |
| GitHub Actions | No production secrets for this native-Git deployment design. Disposable CI database credentials are job-local test values. Connect provider Git apps and require Quality checks; do not add production DATABASE_URL to workflow. |

WhatsApp and delivery policy are actual database-backed administration settings, not invented environment variables. API or domain changes require updating the corresponding provider variables and rebuilding both Pages projects; do not edit React source. Keep ORDER_TOKEN_SECRET stable to preserve receipt access.

SPA routing uses Cloudflare Pages native fallback: neither application publishes a top-level `404.html`, so direct product/category/checkout/admin paths return the React shell. No catch-all `_redirects` rule is necessary (it can be ignored as a rewrite loop by the current provider parser). Keep the native fallback when publishing these output directories. [Official SPA behavior](https://developers.cloudflare.com/pages/configuration/serving-pages/#single-page-application-spa-rendering).

After both Pages projects and Render finish a release, the owner can run **Verify public deployment** from GitHub Actions manually with the actual three URLs and deployed SHA. Its separate workflow uses only GET/OPTIONS and no secrets, order creation or uploads. It is not a required pre-deploy check: requiring it before deployment would create a deployment/health circular wait. Render readiness remains the automatic API health gate.

Local rehearsal note: `pages:build:admin` deliberately runs npm ci for reproducibility. Stop a running admin Vite/preview before rehearsing that command on Windows, where its loaded native compiler module may be locked. Cloudflare builds use a clean Linux checkout.
