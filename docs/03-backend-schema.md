# Backend Schema Document
## Cross-Platform Business Management Application

**Version:** 0.2 (Dual-platform revision) — Prisma-style schema, PostgreSQL
**Last updated:** 2026-08-12

---

This schema is platform-agnostic by design — no table encodes which client (mobile or web) created or reads a row. The mobile app and web app are equal consumers of the same tables via the same API; nothing here changes when the web app is added.

## 1. Entity Overview

```
User ──< BusinessMember >── Business ──< Subscription
                              │
                              ├──< Task >── TaskAssignment ── User
                              │
                              └──< PerformanceReview ── User
```

## 2. Tables

### users
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| google_id | text unique | from Google OAuth |
| email | text unique | |
| name | text | |
| avatar_url | text | nullable |
| created_at | timestamptz | default now() |
| updated_at | timestamptz | |

### businesses
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| name | text | |
| owner_id | uuid FK → users.id | |
| created_at | timestamptz | |

### business_members
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| business_id | uuid FK → businesses.id | |
| user_id | uuid FK → users.id | |
| role | enum('owner','manager','employee','client') | |
| invited_at | timestamptz | |
| joined_at | timestamptz | nullable (null = invite pending) |
| unique(business_id, user_id) | | |

### subscriptions
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| business_id | uuid FK → businesses.id, unique | one active subscription per business |
| razorpay_subscription_id | text unique | |
| plan | enum('free','pro','enterprise') | |
| status | enum('trialing','active','past_due','canceled','incomplete') | mirrors Razorpay subscription status (created/authenticated→incomplete, active→active, pending/halted→past_due, cancelled/completed/expired→canceled) |
| current_period_end | timestamptz | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### invoices
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| business_id | uuid FK → businesses.id | |
| razorpay_payment_id | text unique | |
| amount_due | integer | paise |
| status | enum('draft','open','paid','void','uncollectible') | |
| issued_at | timestamptz | |
| pdf_url | text | nullable |

### tasks
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| business_id | uuid FK → businesses.id | |
| title | text | |
| description | text | nullable |
| status | enum('open','in_progress','done','canceled') | |
| priority | enum('low','medium','high') | |
| due_at | timestamptz | nullable |
| recurrence_rule | text | nullable, RRULE string for recurring tasks |
| created_by | uuid FK → users.id | |
| created_at | timestamptz | |
| updated_at | timestamptz | |
| deleted_at | timestamptz | nullable, soft delete |

### task_assignments
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| task_id | uuid FK → tasks.id | |
| user_id | uuid FK → users.id | |
| assigned_at | timestamptz | |
| completed_at | timestamptz | nullable |
| unique(task_id, user_id) | | |

### performance_reviews
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| business_id | uuid FK → businesses.id | |
| employee_id | uuid FK → users.id | |
| reviewer_id | uuid FK → users.id | |
| period_start | date | |
| period_end | date | |
| rating | integer | 1–5 |
| notes | text | nullable |
| task_completion_rate | numeric(5,2) | computed snapshot at review time |
| on_time_rate | numeric(5,2) | computed snapshot at review time |
| created_at | timestamptz | |

### notifications
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK → users.id | |
| business_id | uuid FK → businesses.id | |
| type | enum('task_assigned','task_due','billing_event','invite') | |
| payload | jsonb | |
| read_at | timestamptz | nullable |
| created_at | timestamptz | |

## 3. Indexing Notes

- Composite index `(business_id, status)` on `tasks` — main dashboard query
- Composite index `(business_id, user_id)` on `business_members` — already covered by unique constraint
- Index `(user_id, read_at)` on `notifications` — unread-count queries
- Index `(business_id, created_at)` on `invoices` — invoice history list

## 4. RBAC Enforcement

Role checks happen in Express middleware, not in the DB (Postgres RLS can be added later via Supabase if direct client-to-DB access is ever introduced). Middleware resolves `req.user` + `req.params.businessId` → looks up `business_members.role` → compares against a per-route required-role list.

## 5. Migration Strategy

- Prisma Migrate, one migration per feature slice (auth → billing → tasks → performance)
- Seed script for local/staging: 1 demo business, 4 demo users (one per role), sample tasks
