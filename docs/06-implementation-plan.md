# Implementation Plan
## Cross-Platform Business Management Application

**Version:** 0.3 (Dual-platform revision)
**Last updated:** 2026-08-12

---

## 0. Decisions locked

| Decision | Choice |
|---|---|
| DB hosting (dev) | Supabase free-tier project, connected via the pooler connection string (required for serverless) |
| Auth implementation | Passport.js Google strategy + our own JWT issuance (keeps auth logic in our API, not tied to Supabase Auth) |
| RN component library | NativeWind (Tailwind for RN) |
| Web framework | **Next.js** (TypeScript, App Router) — deploys to Vercel alongside the API |
| Web component styling | Tailwind CSS, same token config as NativeWind's, so mobile and web share a design language without sharing code |
| Code sharing between mobile/web | **None** — two fully separate codebases, both consuming the same REST API. No React Native Web / Tamagui / Solito. (Decision revisited from the original mobile-only plan when the project moved to dual-platform; see [PRD](01-PRD.md) §5 for the reasoning.) |
| Billing provider | Razorpay (Subscriptions + Standard Checkout), not Stripe — not available for self-serve merchant accounts in India |
| Repo structure | Monorepo: `/api`, `/mobile`, `/web`, `/docs` — single GitHub repo, npm workspaces |
| Package manager | npm workspaces (pnpm was originally planned but hit a permissions issue installing globally in this environment; npm works fine and avoids the dependency) |
| API hosting | Vercel (serverless functions), root directory `api/` |
| Web hosting | Vercel, root directory `web/` — same GitHub repo, separate Vercel project |

## Phase 1 — Backend + DB Foundation ✅ Done

1. Scaffold `/api` Express + TypeScript project
2. Provision Supabase Postgres project; connect Prisma
3. Implement schema from `03-backend-schema.md`; run initial migration + seed script
4. Google OAuth login endpoint + JWT issuance (via one-time-code exchange, not a bare redirect — see [TRD](02-TRD.md) §3)
5. RBAC middleware (`business_members.role` lookup)
6. Core CRUD: businesses, business_members (invite/join), tasks, task_assignments
7. Health check + basic logging (pino) — Sentry not yet wired up (still pending, see Phase 7)

**Exit criteria met:** business creation, invite, task create/assign/complete all verified via authenticated REST calls against the deployed API and live Supabase DB.

## Phase 2 — Billing Module ✅ Done

1. Razorpay account (test mode) + Subscriptions API integration
2. Subscription-creation endpoint + webhook endpoint (HMAC-SHA256 signature-verified)
3. `subscriptions` + `invoices` sync from webhook events
4. Standalone Razorpay Standard Checkout connectivity test page (`/razorpay-test`) — confirms order creation and signature verification work end-to-end independent of the subscriptions flow

**Status:** order creation and signature verification confirmed working against Razorpay's live test API. Full payment capture is currently blocked by the Razorpay account's pending KYC/activation (an account-level restriction, not a code issue) — will be retested once that clears. Feature-gating middleware (reading `subscriptions.status`/`plan` to restrict actions) not yet built.

## Phase 3 — Employee Performance Module ✅ Done

1. Live rate computation (completion rate, on-time rate) from `task_assignments` — no scheduled job, computed on demand (serverless has no persistent process to run a cron on; revisit only if this ever becomes a real performance problem)
2. `performance_reviews` CRUD (Manager/Owner only), snapshotting rates at creation time
3. Membership verified before creating a review (an employeeId must actually belong to the business)

## Phase 4 — Notifications ✅ Done (storage only)

1. `notifications` table + write-on-event hooks (task assigned, billing state change, invite)
2. List / mark-read / mark-all-read endpoints

**Not yet done:** actual delivery. Notifications are currently stored and readable in-app only — Expo Push registration and Resend/SendGrid email integration are still open (folded into Phase 5a/5b below, since they're naturally built alongside each client rather than API-side in isolation).

## Phase 5a — Mobile App (React Native/Expo)

1. Expo project scaffold, NativeWind setup, navigation (bottom tabs from [UI/UX doc](05-uiux-design.md) §2)
2. Google Sign-In flow (Expo AuthSession) → one-time-code exchange → API JWT
3. Business switcher + create/join business screens
4. Task list/detail/create screens wired to API
5. Team + performance screens (role-gated navigation)
6. Billing screen + Razorpay Checkout SDK handoff (React Native SDK)
7. Notifications screen + Expo Push token registration

## Phase 5b — Web App (Next.js)

1. Next.js project scaffold (App Router), Tailwind setup, sidebar navigation (from [UI/UX doc](05-uiux-design.md) §2)
2. Google Sign-In flow (browser redirect) → API JWT — token delivery mechanism (cookie vs. redirect param) to be finalized at scaffold time (see [TRD](02-TRD.md) §3); if cookie-based, revisit the CORS note in TRD §4 (credentialed requests need an explicit origin allowlist, unlike the current bearer-token setup)
3. Business switcher + create/join business pages
4. Task table (list/detail/create) wired to API, with a calendar view toggle
5. Team + performance pages (role-gated), including the rate-trend chart called out in the UI/UX doc as a web-only enhancement
6. Billing page + Razorpay web Checkout widget handoff
7. Notifications page (dedicated sidebar destination, not a dropdown)

**Sequencing note:** 5a and 5b are built in parallel, phase-locked together — per the TRD's stated risk mitigation, neither platform is allowed to get more than one phase ahead of the other, to avoid one becoming the de facto "real" product and the other an afterthought.

## Phase 6 — Notification Delivery

Split out from the old Phase 4 now that it depends on client scaffolding existing:

1. Expo Push token registration + send-on-event (mobile)
2. Resend or SendGrid integration for email delivery (both platforms — invites, receipts, and as the web notification channel per [TRD](02-TRD.md) §2)

## Phase 7 — CI/CD

1. ~~GitHub repo creation~~ ✅ Done — private repo created
2. GitHub Actions: lint + typecheck + test on PR for all three packages (`api`, `mobile`, `web`)
3. Auto-deploy `api/` and `web/` to Vercel on merge to `main` (via Vercel's native GitHub integration — more reliable than the ad-hoc API-token deploy path used for early manual testing, which hit permission errors partway through this project)
4. Expo EAS build pipeline (manual trigger, not on every push — build minutes are limited on free tier)

## Phase 8 — Hardening / Pre-launch

1. RBAC + webhook signature security review
2. Remove or auth-gate the `/razorpay-test` connectivity-test endpoints (currently intentionally open for low-friction testing — must not ship open against a live Razorpay key)
3. Load-test key endpoints (task list, dashboard aggregates)
4. Error tracking setup (Sentry) across API, mobile, and web
5. Data export/delete endpoints (basic GDPR-style compliance)

## Sequencing Rationale

Backend-first because every other phase depends on stable API contracts and the DB schema — this held true through Phases 1-4, which are now done and manually verified against real data. From here, mobile and web are **parallel, not sequential** — the original mobile-only plan built mobile last against a finished API; now that web is co-equal scope, both clients get built together against that same finished API, so neither platform silently becomes secondary.

## Current Status / Next Step

Phases 1-4 are complete (backend: auth, businesses, tasks, billing, performance, notification storage). Docs and repo structure have just been reconfigured for dual-platform (this revision). **Next actual step: scaffold the `/web` Next.js project structure** (Phase 5b step 1), then begin Phase 5a/5b in parallel.
