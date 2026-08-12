# Implementation Plan
## Cross-Platform Business Management Application

**Version:** 0.1 (Draft)
**Last updated:** 2026-08-12

---

## 0. Decisions to lock before coding

| Decision | Recommendation |
|---|---|
| DB hosting (dev) | Supabase free-tier project (provisioned via connected MCP tools) |
| Auth implementation | Passport.js Google strategy + our own JWT issuance (keeps auth logic in our API, not tied to Supabase Auth, in case DB provider changes later) |
| RN component library | NativeWind (Tailwind for RN) — fastest to match the design tokens in doc 05 |
| Repo structure | Monorepo: `/api`, `/mobile`, `/docs` — single GitHub repo, simpler CI |
| Package manager | pnpm (fast, disk-efficient) |

## Phase 1 — Backend + DB Foundation (current phase)

1. Scaffold `/api` Express + TypeScript project (eslint, prettier, tsconfig)
2. Provision Supabase Postgres project; connect Prisma
3. Implement schema from `03-backend-schema.md`; run initial migration + seed script
4. Google OAuth login endpoint + JWT issuance
5. RBAC middleware (`business_members.role` lookup)
6. Core CRUD: businesses, business_members (invite/join), tasks, task_assignments
7. Health check + basic logging (pino) + Sentry hookup
8. Postman/Insomnia collection for manual testing

**Exit criteria:** can create a business, invite a member, create/assign/complete a task, all via authenticated REST calls — verified with real HTTP requests, not just unit tests.

## Phase 2 — Billing Module

1. Stripe account (test mode) + products/prices for Free/Pro/Enterprise
2. Checkout session endpoint + webhook endpoint (signature-verified)
3. `subscriptions` + `invoices` sync from webhook events
4. Feature-gating middleware reading `subscriptions.status`/`plan`
5. Local webhook testing via `stripe listen`

**Exit criteria:** full trial → upgrade → webhook-confirmed active subscription → invoice recorded, in test mode end to end.

## Phase 3 — Employee Performance Module

1. Nightly job (node-cron or Supabase scheduled function) computing completion/on-time rates
2. `performance_reviews` CRUD (Manager/Owner only)
3. Team performance dashboard endpoints (aggregate queries)

## Phase 4 — Notifications

1. `notifications` table + write-on-event hooks (task assigned/due, billing state change, invite)
2. Expo Push token registration endpoint
3. Email provider integration (Resend/SendGrid) for invites + receipts

## Phase 5 — Mobile App (React Native/Expo)

1. Expo project scaffold, NativeWind setup, navigation (bottom tabs from doc 05)
2. Google Sign-In flow (Expo AuthSession) → API JWT exchange
3. Business switcher + create/join business screens
4. Task list/detail/create screens wired to API
5. Team + performance screens (role-gated navigation)
6. Billing screen + Stripe Checkout handoff (in-app browser)
7. Notifications screen + push registration

## Phase 6 — CI/CD

1. GitHub repo creation (after GitHub connector authorized)
2. GitHub Actions: lint + typecheck + test on PR; deploy `/api` to Render/Railway on merge to `main`
3. Expo EAS build pipeline (manual trigger initially, not on every push — build minutes are limited on free tier)

## Phase 7 — Hardening / Pre-launch

1. RBAC + webhook signature security review
2. Load-test key endpoints (task list, dashboard aggregates)
3. Error tracking review (Sentry) on staging with seeded traffic
4. Data export/delete endpoints (basic GDPR-style compliance)

## Sequencing Rationale

Backend-first because every other phase (billing, performance, mobile) depends on stable API contracts and the DB schema. Mobile is deliberately last among build phases so it's built against a working, testable API rather than mocked endpoints that drift from reality.

## Immediate Next Step

Per current instruction: proceed to **Phase 1** — scaffold `/api` and provision the Supabase database.
