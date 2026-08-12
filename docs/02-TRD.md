# Technical Requirements Document (TRD)
## Cross-Platform Business Management Application

**Version:** 0.1 (Draft)
**Last updated:** 2026-08-12

---

## 1. Architecture Overview

```
┌─────────────────────┐        ┌──────────────────────┐
│  React Native App    │ HTTPS  │   Express REST API    │
│  (Expo, iOS/Android) │◄──────►│   (Node.js, TS)       │
└─────────────────────┘        └───────────┬───────────┘
                                            │
                       ┌────────────────────┼────────────────────┐
                       ▼                    ▼                    ▼
              ┌────────────────┐   ┌────────────────┐   ┌────────────────┐
              │ PostgreSQL      │   │ Razorpay        │   │ Google OAuth    │
              │ (Supabase)      │   │ (billing)       │   │ (auth)          │
              └────────────────┘   └────────────────┘   └────────────────┘
```

Web admin panel is a phase-2 client consuming the same REST API — no backend changes required to add it.

## 2. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Mobile client | React Native + Expo (TypeScript) | Managed workflow for dev speed; eject only if a native module forces it |
| API | Node.js + Express (TypeScript) | REST, versioned under `/api/v1` |
| ORM | Prisma | Type-safe schema, migrations |
| Database | PostgreSQL (Supabase free tier in dev) | Row-level security available if needed later |
| Auth | Google OAuth 2.0 + JWT session tokens | Passport.js or Supabase Auth (decide in Implementation Plan) |
| Payments | Razorpay (Subscriptions + Webhooks) | India-available, free to start (pay-per-transaction, no monthly fee); test mode in dev |
| Push notifications | Expo Push Notifications | Free, no extra service needed |
| Email | Resend or SendGrid free tier | Transactional email (invites, receipts) |
| CI/CD | GitHub Actions | Lint, typecheck, test, deploy on merge to main |
| API hosting (dev/free) | Render.com or Railway free tier | Swap for AWS/GCP at scale |
| Error tracking | Sentry free tier | Both mobile and API |

## 3. API Design Principles

- REST, resource-oriented (`/businesses/:id/tasks`, `/businesses/:id/employees`)
- All endpoints scoped to a `businessId` (multi-tenant from day one)
- AuthN via JWT bearer token; AuthZ via role middleware checking role against the business
- Razorpay webhooks on a dedicated unauthenticated route verified by HMAC-SHA256 signature
- Pagination via cursor (`?cursor=`) for list endpoints
- Consistent error shape: `{ error: { code, message } }`

## 4. Multi-Tenancy Model

- Single database, shared schema, `business_id` foreign key on all business-scoped tables (simplest for MVP; revisit schema-per-tenant only if compliance demands it)
- A user can belong to multiple businesses via a join table (`business_members`) with a `role` column

## 5. Non-Functional Requirements

| Category | Requirement |
|---|---|
| Availability | Best-effort in dev (free-tier hosting has cold starts); target 99.5% post-launch |
| Performance | API p95 < 400ms for list/read endpoints on free-tier hardware |
| Security | HTTPS only, secrets in env vars/secret manager, no PII in logs, RBAC enforced server-side (never trust client role claims alone) |
| Data retention | Soft-delete for tasks/employees; hard-delete only on explicit account deletion request |
| Scalability | Stateless API (horizontally scalable), DB connection pooling (PgBouncer via Supabase) |
| Compliance | Razorpay handles PCI scope (no card data touches our servers); GDPR-style data export/delete endpoints planned phase 2 |

## 6. Environments

- **local** — Docker-optional, Expo dev client, local `.env`
- **staging** — free-tier deploy (Render/Railway) + Supabase dev project, used for QA
- **production** — deferred until MVP validated; same infra, paid tiers as needed

## 7. Key Technical Risks

| Risk | Mitigation |
|---|---|
| Razorpay webhook reliability in dev (localhost) | Use a tunnel (ngrok/Cloudflare Tunnel) to expose localhost for Razorpay's test-mode webhook deliveries |
| Free-tier DB/API cold starts hurting demo UX | Acceptable for dev; document as known limitation |
| RN + Expo native module gaps (e.g. background task tracking) | Scope MVP to Expo-supported APIs only; flag anything requiring bare workflow early |
| Multi-role auth complexity | Keep role set small (4 roles) and enforce centrally in one middleware, not scattered per-route |
