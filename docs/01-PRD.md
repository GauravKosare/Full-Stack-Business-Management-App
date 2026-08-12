# Product Requirements Document (PRD)
## Cross-Platform Business Management Application

**Version:** 0.2 (Dual-platform revision)
**Owner:** Gpkos
**Last updated:** 2026-08-12

---

## 1. Problem Statement

Small and mid-size businesses currently juggle multiple disconnected tools to run daily operations — one app for billing/subscriptions, another for scheduling, a spreadsheet for employee performance. This fragmentation costs time, causes data drift between systems, and makes it hard to see a unified picture of the business.

## 2. Goal

Build a **dual-platform application — a mobile app (iOS/Android) and a web app** — both backed by one shared REST API, that unifies:
- Billing & subscription management (Razorpay)
- Task scheduling
- Employee performance tracking
- Multi-role authentication (Owner / Manager / Employee / Client, via Google OAuth)

Both platforms are first-class from the start — the web app is not a scaled-down or later-stage version of the mobile app. Field/frontline roles (Employee, Manager on the move) are expected to lean on mobile; desk-based roles (Owner reviewing billing/reports, Manager planning schedules) are expected to lean on web. The API is platform-agnostic by design (see [TRD](02-TRD.md)), so both clients consume identical endpoints.

Target outcome: reduce operational overhead and improve task-tracking efficiency (~40% target, based on prior internal benchmark).

## 3. Target Users / Roles

| Role | Description | Key needs | Primary platform |
|---|---|---|---|
| **Owner/Admin** | Business owner, full access | Billing oversight, all reports, role management | Web (reporting/billing), mobile (on-the-go checks) |
| **Manager** | Runs a team/department | Assign tasks, review employee performance, limited billing view | Both — planning on web, day-to-day on mobile |
| **Employee** | Front-line staff | View/complete assigned tasks, clock work, see own performance | Mobile-first |
| **Client (optional, phase 2)** | External customer | View invoices, make payments, see service status | Web |

## 4. Core Features (MVP scope — applies to both platforms)

1. **Auth & Roles**
   - Google OAuth sign-in (same flow underneath: server-side Authorization Code exchange; mobile uses a one-time-code deep link, web uses a standard browser redirect)
   - Role-based access control (RBAC) at API and UI level
   - Invite flow for adding employees/managers to a business account

2. **Billing & Subscriptions**
   - Razorpay Subscriptions for subscription plans (per business account) — chosen over Stripe because Stripe isn't available for standard self-serve merchant accounts in India
   - Webhook-driven subscription state sync (active, past_due, canceled)
   - Plan tiers (e.g. Free / Pro / Enterprise) gating feature access
   - Invoice history view
   - Razorpay Checkout SDK on both platforms (React Native SDK on mobile, Standard Checkout web widget on web) — no hosted redirect page exists for either

3. **Task Scheduling**
   - Create/assign/reassign tasks with due dates, priority, status
   - Recurring tasks (daily/weekly/monthly)
   - Calendar + list views
   - Notifications on assignment / due date approaching

4. **Employee Performance Tracking**
   - Task completion rate, on-time rate per employee (computed live from task data)
   - Manager-entered performance notes/ratings (periodic review)
   - Dashboard: team performance overview for Managers/Owners — the wider web layout is expected to be the primary surface for this, given it's report-like content

5. **Notifications**
   - In-app notification center on both platforms
   - Push (mobile, via Expo) + email (web and mobile) for task assignment, due dates, billing events

## 5. Out of Scope (MVP)

- Payroll processing
- Native desktop app (Windows/Mac) — the web app covers the "desktop-class screen" use case via a responsive browser experience, so a separate desktop build isn't planned
- Multi-currency billing
- Offline-first sync (nice-to-have, not required for v1)
- Shared UI code between mobile and web (React Native Web, Tamagui, etc.) — deliberately two separate frontend codebases against one API, to avoid cross-platform abstraction overhead at MVP stage; revisit only if duplication becomes a real maintenance cost

## 6. Success Metrics

- Task completion turnaround time (target: -40% vs. manual/spreadsheet baseline)
- % of businesses with active Razorpay subscription after 14-day trial
- Weekly active managers/employees per account, tracked per platform (mobile vs. web) to validate the platform-per-role assumptions in §3

## 7. Constraints & Assumptions

- Free/low-cost tooling for development phase (Supabase free tier, Razorpay test mode, Expo, Vercel free tier for both API and web app)
- Single region deployment initially
- English-only UI for v1
- Both frontends are separate codebases with no shared component layer; consistency between them is enforced via a shared design language (see [UI/UX doc](05-uiux-design.md)), not shared code

## 8. Milestones (high-level; see Implementation Plan for detail)

1. Docs & architecture (this set of 6 documents)
2. Backend + DB schema + auth
3. Billing module (Razorpay)
4. Task scheduling module
5. Employee performance module
6. Mobile app (React Native/Expo) wired to API
7. Web app (Next.js) wired to API
8. CI/CD + free-tier deployment for all three (API, mobile, web)
