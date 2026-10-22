# Automated Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Independent scoped workers may implement frontend and API tasks concurrently.

**Goal:** Prepare safe Git-driven deployment of the existing three applications and verify every feasible local behavior without external account work.

**Architecture:** Independent Cloudflare Pages Git builds; Docker API on a prepared Render blueprint with managed PostgreSQL and persistent uploads; GitHub CI against disposable databases. All origins read from platform environment variables.

**Tech Stack:** existing React/Vite, NestJS/Prisma/Postgres, Node 24, GitHub Actions, Cloudflare Pages, Render Docker.

**Spec:** ../specs/2026-10-22-automated-deployment-design.md

## Global Constraints
No external provisioning, account login, credential extraction, data resets or sample seed in production. No production DB in CI. No invented commercial email/password/WhatsApp. Preserve prior tests and database records. Production branch is main consistently across documented settings and workflows.

## Review Focus
- Old relative upload URLs on a different API origin must load in all image/metadata consumers.
- Pages build must fail on missing/HTTP/local API/site origins rather than publish a broken artifact.
- CI must never reuse the local or production DATABASE_URL; tests use generated or service-owned _test databases.
- Native Pages build starts independently of GitHub checks; document the exact gates and branch protection.
- Persisted image directory must survive restart/redeploy and never be erased by build/migration scripts.

## Tasks
- [x] 1. Frontend worker: src/lib image URL resolution + image/SEO consumers + meaningful regression tests; preserve relative local/Nginx behavior and admin compatibility.
- [x] 2. API worker: production configuration validation/proxy trust, migration startup command, tests; existing secure admin provisioning and explicit backup targeting preserved/documented. Own api/ only; env/startup contract integrated.
- [x] 3. CI worker: .github/workflows/ci.yml, render.yaml, docs/git-deploy.md. All checks on PR/main using disposable PostgreSQL; Render checksPass, persistent disk and migrations. No external mutations.
- [x] 4. Root: Pages checked build and env examples, static headers/native SPA/revision, local independent-origin browser verification, safe read-only public smoke and manual workflow, docs/README/verification and independent final review.

## Ledger
Ruling: proceed from the user's detailed implementation brief without approval pauses, as explicitly requested. Root coordinates scoped work and executes final verification. No Git metadata: commits/worktrees are unavailable; preserve files in place. External accounts/real admin and commercial settings are owner actions, not claimed complete.

Final evidence: docs/verification-automated-deployment-2026-10-22.md. 71 frontend + 13 admin + 37 API + 8 deployment tests passed; five cross-origin browser scenarios passed, including 450 viewport checks; checked Pages builds and all three normal builds/lint passed. Independent review's local-host bypass was fixed red-to-green; redundant redirect rules removed in favor of native Pages fallback. Manual public verification workflow schema corrected to explicit string inputs and validated. No public deployment, remote Git push, real admin, external disk or hosted backup claim.
