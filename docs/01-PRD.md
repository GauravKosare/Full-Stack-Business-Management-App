# Product Requirements Document (PRD)
## Cross-Platform Business Management Application

**Version:** 0.1 (Draft)
**Owner:** Gpkos
**Last updated:** 2026-08-12

---

## 1. Problem Statement

Small and mid-size businesses currently juggle multiple disconnected tools to run daily operations — one app for billing/subscriptions, another for scheduling, a spreadsheet for employee performance. This fragmentation costs time, causes data drift between systems, and makes it hard to see a unified picture of the business.

## 2. Goal

Build a single cross-platform (mobile + web-ready backend) application that unifies:
- Billing & subscription management (Stripe)
- Task scheduling
- Employee performance tracking
- Multi-role authentication (Owner / Manager / Employee / Client, via Google OAuth)

Target outcome: reduce operational overhead and improve task-tracking efficiency (~40% target, based on prior internal benchmark).

## 3. Target Users / Roles

| Role | Description | Key needs |
|---|---|---|
| **Owner/Admin** | Business owner, full access | Billing oversight, all reports, role management |
| **Manager** | Runs a team/department | Assign tasks, review employee performance, limited billing view |
| **Employee** | Front-line staff | View/complete assigned tasks, clock work, see own performance |
| **Client (optional, phase 2)** | External customer | View invoices, make payments, see service status |

## 4. Core Features (MVP scope)

1. **Auth & Roles**
   - Google OAuth sign-in
   - Role-based access control (RBAC) at API and UI level
   - Invite flow for adding employees/managers to a business account

2. **Billing & Subscriptions**
   - Stripe Checkout for subscription plans (per business account)
   - Webhook-driven subscription state sync (active, past_due, canceled)
   - Plan tiers (e.g. Free / Pro / Enterprise) gating feature access
   - Invoice history view

3. **Task Scheduling**
   - Create/assign/reassign tasks with due dates, priority, status
   - Recurring tasks (daily/weekly/monthly)
   - Calendar + list views
   - Notifications on assignment / due date approaching

4. **Employee Performance Tracking**
   - Task completion rate, on-time rate per employee
   - Manager-entered performance notes/ratings (periodic review)
   - Dashboard: team performance overview for Managers/Owners

5. **Notifications**
   - Push (mobile) + email for task assignment, due dates, billing events

## 5. Out of Scope (MVP)

- Payroll processing
- Native desktop app (web admin panel is a stretch goal, not MVP)
- Multi-currency billing
- Offline-first sync (nice-to-have, not required for v1)

## 6. Success Metrics

- Task completion turnaround time (target: -40% vs. manual/spreadsheet baseline)
- % of businesses with active Stripe subscription after 14-day trial
- Weekly active managers/employees per account

## 7. Constraints & Assumptions

- Free/low-cost tooling for development phase (Supabase free tier, Stripe test mode, Expo, Render/Railway free tier)
- Single region deployment initially
- English-only UI for v1

## 8. Milestones (high-level; see Implementation Plan for detail)

1. Docs & architecture (this set of 6 documents)
2. Backend + DB schema + auth
3. Billing module (Stripe)
4. Task scheduling module
5. Employee performance module
6. Mobile app (React Native/Expo) wired to API
7. CI/CD + free-tier deployment
