# Technical Requirements Document (TRD)
## Cross-Platform Business Management Application

**Version:** 0.2 (Dual-platform revision)
**Last updated:** 2026-08-12

---

## 1. Architecture Overview

```
┌──────────────────────┐   ┌──────────────────────┐
│  React Native App     │   │  Next.js Web App      │
│  (Expo, iOS/Android)  │   │  (Vercel)              │
└───────────┬────────────┘   └───────────┬────────────┘
            │             HTTPS           │
            └──────────────┬──────────────┘
                            ▼
                  ┌──────────────────────┐
                  │   Express REST API     │
                  │   (Node.js, TS, Vercel)│
                  └───────────┬───────────┘
                              │
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
┌────────────────┐   ┌────────────────┐   ┌────────────────┐
│ PostgreSQL      │   │ Razorpay        │   │ Google OAuth    │
│ (Supabase)      │   │ (billing)       │   │ (auth)          │
└────────────────┘   └────────────────┘   └────────────────┘
```

Both clients are **independent codebases consuming the same REST API** — neither is a wrapper around the other, and there's no shared UI/component layer between them (see PRD §5 for the reasoning: avoiding cross-platform abstraction overhead at MVP stage). The API has no knowledge of which client is calling it beyond what's in the JWT; there is no mobile-only or web-only endpoint.

## 2. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Mobile client | React Native + Expo (TypeScript) | Managed workflow for dev speed; eject only if a native module forces it |
| Web client | Next.js (TypeScript, App Router) | Deploys to Vercel alongside the API; SSR/routing built in, standard choice for a dashboard-style business app |
| API | Node.js + Express (TypeScript) | REST, versioned under `/api/v1`, deployed as a Vercel serverless function |
| ORM | Prisma | Type-safe schema, migrations |
| Database | PostgreSQL (Supabase free tier in dev) | Connected via Supabase's connection **pooler**, not a direct connection — required for serverless (Vercel) to avoid exhausting Postgres connection limits under concurrent invocations |
| Auth | Google OAuth 2.0 (Authorization Code flow) + JWT bearer tokens | One Passport.js Google strategy on the server for both clients; mobile exchanges a short-lived one-time code for the JWT (see §3), web can use a direct browser redirect since it doesn't need to hand the token across a URL scheme |
| Payments | Razorpay (Subscriptions + Standard Checkout + Webhooks) | India-available, free to start; client SDK differs per platform (React Native SDK vs. web Checkout widget) but hits the same backend endpoints |
| Push notifications | Expo Push Notifications | Mobile only — web uses in-app notification center + email instead of browser push at MVP stage |
| Email | Resend or SendGrid free tier | Transactional email (invites, receipts) — shared by both platforms |
| CI/CD | GitHub Actions | Lint, typecheck, test on PR for all three packages (api/mobile/web); deploy API + web to Vercel on merge to main |
| Hosting (API + web) | Vercel free tier | Both deployed from the same GitHub repo, as separate Vercel projects with different root directories (`api/`, `web/`) |
| Mobile builds | Expo EAS | Manual trigger, not on every push (build minutes are limited on free tier) |
| Error tracking | Sentry free tier | Mobile, web, and API |

## 3. Auth Flow Differences Between Platforms

The underlying OAuth exchange is identical (server-side Authorization Code flow against Google, our Express server as the confidential client — see [workflow doc](04-workflow.md) §1). Where the two platforms diverge is *only* in how they receive the resulting JWT:

- **Mobile**: browser → Google → our `/auth/google/callback` → redirect to a custom URL scheme (`myapp://auth?code=...`) carrying a single-use, 60-second code (not the JWT itself, since custom URL schemes can be intercepted by other apps on the device) → app calls `POST /auth/exchange` to trade that code for the real JWT.
- **Web**: browser → Google → our `/auth/google/callback` → can redirect straight back to a page on the web app's own origin with the JWT, since there's no URL-scheme-hijacking risk in a browser context. (Exact mechanism — cookie vs. redirect param — to be finalized when the web app is scaffolded; likely an httpOnly cookie set directly by the callback, since that avoids ever putting the JWT in a URL at all.)

Both end up with the same JWT format, checked by the same `requireAuth` middleware — the API doesn't need to know or care which flow produced it.

## 4. API Design Principles

- REST, resource-oriented (`/businesses/:id/tasks`, `/businesses/:id/employees`)
- All endpoints scoped to a `businessId` (multi-tenant from day one)
- AuthN via JWT bearer token; AuthZ via role middleware checking role against the business
- Razorpay webhooks on a dedicated unauthenticated route verified by HMAC-SHA256 signature
- Pagination via cursor (`?cursor=`) for list endpoints
- Consistent error shape: `{ error: { code, message } }`
- CORS is open (no origin allowlist) since auth is bearer-token-based, not cookie-based, for API calls — a browser web client and a native mobile client hit the same permissive CORS config with no special-casing needed. (If the web app's JWT delivery ends up cookie-based per §3, this will need revisiting — cookies require an explicit origin allowlist + `credentials: true`, unlike bearer tokens.)

## 5. Multi-Tenancy Model

- Single database, shared schema, `business_id` foreign key on all business-scoped tables (simplest for MVP; revisit schema-per-tenant only if compliance demands it)
- A user can belong to multiple businesses via a join table (`business_members`) with a `role` column

## 6. Non-Functional Requirements

| Category | Requirement |
|---|---|
| Availability | Best-effort in dev (free-tier hosting has cold starts); target 99.5% post-launch |
| Performance | API p95 < 400ms for list/read endpoints on free-tier hardware |
| Security | HTTPS only, secrets in env vars/secret manager, no PII in logs, RBAC enforced server-side (never trust client role claims alone) |
| Data retention | Soft-delete for tasks/employees; hard-delete only on explicit account deletion request |
| Scalability | Stateless API (horizontally scalable), DB connection pooling (PgBouncer via Supabase) |
| Compliance | Razorpay handles PCI scope (no card data touches our servers); GDPR-style data export/delete endpoints planned phase 2 |
| Responsiveness (web) | Web app must be usable down to tablet width at minimum; full phone-width support is a nice-to-have, not a requirement, since mobile users have the native app |

## 7. Environments

- **local** — Docker-optional, Expo dev client + `next dev`, local `.env` files (one per package)
- **staging** — free-tier deploy (Vercel) for both API and web + Supabase dev project, used for QA
- **production** — deferred until MVP validated; same infra, paid tiers as needed

## 8. Key Technical Risks

| Risk | Mitigation |
|---|---|
| Razorpay webhook reliability in dev (localhost) | Use a tunnel (ngrok/Cloudflare Tunnel) to expose localhost for Razorpay's test-mode webhook deliveries |
| Free-tier DB/API cold starts hurting demo UX | Acceptable for dev; document as known limitation |
| RN + Expo native module gaps (e.g. background task tracking) | Scope MVP to Expo-supported APIs only; flag anything requiring bare workflow early |
| Multi-role auth complexity | Keep role set small (4 roles) and enforce centrally in one middleware, not scattered per-route |
| Feature drift between mobile and web (one platform gets a feature the other doesn't) | Both platforms build against the same API surface simultaneously per phase, per the Implementation Plan — no platform is allowed to get more than one phase ahead of the other |
| Two frontends doubling UI maintenance work | Accepted tradeoff per PRD §5 (fully separate over shared UI layer); mitigated by a shared design language (tokens, not code) in the UI/UX doc |
