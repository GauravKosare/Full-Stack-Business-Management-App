# UI/UX Design Document
## Cross-Platform Business Management Application

**Version:** 0.1 (Draft)
**Last updated:** 2026-08-12

---

## 1. Design Principles

- **Role-first navigation** — what a user sees on launch depends on their role in the active business, not a generic dashboard
- **One-hand mobile use** — primary actions (mark task done, approve, etc.) reachable within thumb range
- **Status at a glance** — color-coded badges for task status, subscription status, review ratings
- **Minimal free-tier design cost** — build with a small reusable component set rather than bespoke screens per feature

## 2. Information Architecture / Navigation

```
Bottom Tab Bar (mobile)
├── Home (role-aware dashboard)
├── Tasks (list/calendar toggle)
├── Team (Owner/Manager only) — members, roles, performance
├── Billing (Owner only; Manager sees read-only)
└── Profile (notifications, settings, sign out)
```

- Business switcher accessible from Home header (for users belonging to multiple businesses)
- Employee role sees a reduced tab set: Home, Tasks, Profile (no Team/Billing tabs)

## 3. Core Screens (MVP)

| Screen | Key elements |
|---|---|
| **Sign in** | Google Sign-In button only; minimal branding |
| **Create/select business** | List of businesses user belongs to + "Create business" CTA |
| **Home (Owner/Manager)** | Task summary cards (open/overdue), team performance snippet, billing status banner |
| **Home (Employee)** | My tasks today, upcoming due, quick "mark done" |
| **Task list** | Filter by status/assignee/priority, swipe actions (complete/reassign) |
| **Task detail** | Title, description, assignee(s), due date, status stepper, activity log |
| **New/edit task** | Form: title, description, assignee picker, due date, priority, recurrence |
| **Team (members list)** | Avatar, name, role badge, invite button, tap → member detail |
| **Member detail / performance** | Completion rate, on-time rate, review history, "add review" (Manager+) |
| **Billing** | Current plan card, usage vs. limits, "Upgrade" CTA, invoice history list |
| **Pricing/Upgrade** | Plan comparison cards → Stripe Checkout handoff |
| **Notifications** | Chronological list, unread indicator, tap-through to source (task/invoice) |

## 4. Design System Basics

| Token | Value (starting point) |
|---|---|
| Primary color | Blue 600 (e.g. `#2563EB`) |
| Success (done/active) | Green 600 |
| Warning (due soon/past_due) | Amber 500 |
| Danger (overdue/canceled) | Red 600 |
| Font | System default (San Francisco/Roboto) — no custom font in MVP to reduce bundle size |
| Spacing scale | 4/8/12/16/24/32 px |
| Corner radius | 8px cards, 999px pills for badges |
| Component library | React Native Paper or NativeWind (Tailwind for RN) — pick one in Implementation Plan to avoid mixing systems |

## 5. Status Badge Conventions

- Task: `open` gray · `in_progress` blue · `done` green · `canceled` red (strikethrough)
- Subscription: `trialing` amber · `active` green · `past_due` red · `canceled` gray
- Overdue task: red due-date text + bell icon

## 6. Accessibility Notes

- Minimum touch target 44x44pt
- Color is never the only status signal — always paired with text/icon
- Support system font scaling (no fixed-height text containers for critical copy)

## 7. Phase 2 (not MVP)

- Web admin panel (same design tokens, responsive layout)
- Dark mode
- Client-facing portal (invoices, service status)
