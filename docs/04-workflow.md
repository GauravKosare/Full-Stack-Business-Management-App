# Workflow Document
## Cross-Platform Business Management Application

**Version:** 0.1 (Draft)
**Last updated:** 2026-08-12

---

## 1. Business Onboarding

1. User signs in with Google OAuth (becomes a `user` record)
2. User creates a business → becomes `owner` in `business_members`
3. System creates business with `plan = free`, `status = trialing` (no Stripe customer yet)
4. Owner invites teammates by email → `business_members` row created with `role`, `joined_at = null`
5. Invitee signs in with Google OAuth → if email matches a pending invite, auto-joins that business; sets `joined_at`

## 2. Billing & Subscription Lifecycle

1. Owner selects a plan (Pro/Enterprise) from in-app pricing screen
2. API creates/reuses Stripe Customer for the business, creates Stripe Checkout Session, returns URL
3. App opens Checkout in browser/webview
4. On success, Stripe redirects back; **source of truth is the webhook, not the redirect**
5. Stripe webhook `checkout.session.completed` → API creates/updates `subscriptions` row
6. Ongoing webhooks (`invoice.paid`, `customer.subscription.updated`, `customer.subscription.deleted`) keep `subscriptions.status` and `invoices` in sync
7. Feature gating middleware checks `subscriptions.status` + `plan` before allowing plan-restricted actions (e.g. employee count over free-tier limit)
8. On `past_due`/`canceled`, app shows a billing banner; grace period logic (e.g. 3 days) before feature restriction — configurable

## 3. Task Lifecycle

```
created (open) → assigned → in_progress → done
                     │
                     └──► canceled (any state before done)
```

1. Manager/Owner creates a task, optionally sets `recurrence_rule`
2. Task assigned to one or more employees → `task_assignments` rows created → notification sent (push/email)
3. Employee updates status to `in_progress` when starting
4. Employee marks `done` → sets `task_assignments.completed_at`
5. If `due_at` passes without completion → scheduled job flags task and sends a reminder notification
6. If recurring, a background job generates the next occurrence when the current one reaches `done` or on schedule

## 4. Employee Performance Tracking

1. Background job (nightly) recomputes rolling `task_completion_rate` and `on_time_rate` per employee per business
2. Manager opens performance dashboard → sees computed rates + task history
3. Manager creates a `performance_reviews` entry (periodic, e.g. monthly/quarterly) with rating + notes, snapshotting current rates
4. Employee can view their own review history (read-only)

## 5. Notification Flow

- Event occurs (task assigned, due soon, billing state change, invite) → API writes `notifications` row → pushes via Expo Push (mobile) and/or email
- App polls/subscribes for unread count on load; marks `read_at` when opened

## 6. Role Permission Matrix

| Action | Owner | Manager | Employee | Client |
|---|---|---|---|---|
| Manage billing | ✅ | 👁 view only | ❌ | 👁 own invoices only |
| Invite/remove members | ✅ | ✅ (employees only) | ❌ | ❌ |
| Create/assign tasks | ✅ | ✅ | ❌ | ❌ |
| Update own task status | ✅ | ✅ | ✅ | ❌ |
| View team performance | ✅ | ✅ (own team) | ❌ | ❌ |
| View own performance | ✅ | ✅ | ✅ | ❌ |
| Submit performance review | ✅ | ✅ | ❌ | ❌ |

## 7. Error / Edge Cases to Handle

- Webhook arrives before Checkout redirect completes → app must not assume success from redirect alone
- Employee removed from business while having open tasks → tasks stay assigned but flagged "assignee removed" for manager reassignment
- Duplicate Google sign-in across businesses → same `user.id` reused, new `business_members` row per business
- Invite sent to email not yet registered → invite persists until first sign-in with matching email
