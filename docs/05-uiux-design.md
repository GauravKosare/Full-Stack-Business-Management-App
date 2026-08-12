# UI/UX Design Document
## Cross-Platform Business Management Application

**Version:** 0.2 (Dual-platform revision)
**Last updated:** 2026-08-12

---

## 1. Design Principles

- **Role-first navigation** — what a user sees on launch depends on their role in the active business, not a generic dashboard
- **Platform-appropriate, not platform-identical** — mobile and web share the same design tokens, status conventions, and screen *content*, but each uses its own native navigation pattern (bottom tabs vs. sidebar) rather than forcing one platform's layout onto the other
- **One-hand mobile use** — primary actions (mark task done, approve, etc.) reachable within thumb range on mobile
- **Desk-friendly density on web** — web can show more information per screen (tables, side-by-side panels) than mobile's single-column layout, since desk-based roles are the primary web audience (see PRD §3)
- **Status at a glance** — color-coded badges for task status, subscription status, review ratings, identical on both platforms
- **Minimal free-tier design cost** — build with a small reusable component set per platform rather than bespoke screens per feature

## 2. Information Architecture / Navigation

### Mobile (React Native / Expo)

```
Bottom Tab Bar
├── Home (role-aware dashboard)
├── Tasks (list/calendar toggle)
├── Team (Owner/Manager only) — members, roles, performance
├── Billing (Owner only; Manager sees read-only)
└── Profile (notifications, settings, sign out)
```

- Business switcher accessible from Home header (for users belonging to multiple businesses)
- Employee role sees a reduced tab set: Home, Tasks, Profile (no Team/Billing tabs)

### Web (Next.js)

```
Sidebar (persistent, collapsible on tablet width)
├── Dashboard (role-aware — same content as mobile Home, denser layout)
├── Tasks (table view by default, calendar view toggle)
├── Team (Owner/Manager only) — member table, performance drill-down
├── Billing (Owner only; Manager sees read-only)
├── Notifications (dedicated page, not just a dropdown — same content as mobile's Notifications screen)
└── Profile / business switcher (top-right header, not sidebar)
```

- Sidebar nav is the web convention for this class of app (dashboard-style, desk use) — a top nav bar was considered and rejected since it doesn't scale well past ~5 sections and this app already has that many
- Employee role sees a reduced sidebar: Dashboard, Tasks, Profile (mirrors mobile's reduced tab set)
- Below tablet width (per TRD §6, full phone-width support on web is a nice-to-have not a requirement), the sidebar collapses to a hamburger menu — but a phone-width user on web is expected to be a rare case since the native app is available

### Why they differ

Bottom tabs are the mobile-native pattern for a small, fixed set of top-level destinations reachable one-handed. A sidebar is the web-native pattern for the same destinations when screen width allows more permanent chrome and users navigate with a mouse/keyboard, not a thumb. Both expose the *same five destinations* (minus the platform-specific placement of Notifications and Profile) — this is a navigation-pattern difference, not a feature difference.

## 3. Core Screens (MVP)

Screen content is shared across platforms; layout differs (mobile = single column, stacked; web = often multi-column, with tables replacing scrollable lists).

| Screen | Key elements | Web-specific layout note |
|---|---|---|
| **Sign in** | Google Sign-In button only; minimal branding | Centered card on web instead of full-screen mobile layout |
| **Create/select business** | List of businesses user belongs to + "Create business" CTA | Same |
| **Dashboard/Home (Owner/Manager)** | Task summary cards (open/overdue), team performance snippet, billing status banner | Web shows these as a multi-column grid instead of stacked cards |
| **Dashboard/Home (Employee)** | My tasks today, upcoming due, quick "mark done" | Same content, denser on web |
| **Task list** | Filter by status/assignee/priority, swipe actions (complete/reassign) | Web: a sortable/filterable **table**, not a swipeable list; row actions replace swipe gestures |
| **Task detail** | Title, description, assignee(s), due date, status stepper, activity log | Web: often a side panel/drawer rather than a full page navigation, so the list stays visible |
| **New/edit task** | Form: title, description, assignee picker, due date, priority, recurrence | Web: modal/drawer form instead of a full-screen mobile form |
| **Team (members list)** | Avatar, name, role badge, invite button, tap → member detail | Web: table with inline role editing where mobile requires a tap-through |
| **Member detail / performance** | Completion rate, on-time rate, review history, "add review" (Manager+) | Web can show rate trends as a small chart alongside the numbers; mobile shows numbers only at MVP |
| **Billing** | Current plan card, usage vs. limits, "Upgrade" CTA, invoice history list | Web: invoice history as a table with a download-PDF-style link per row (once Razorpay invoice PDFs are wired up) |
| **Pricing/Upgrade** | Plan comparison cards → Razorpay Checkout SDK handoff | Web uses the Razorpay web Checkout widget; mobile uses the React Native SDK — same backend contract either way |
| **Notifications** | Chronological list, unread indicator, tap-through to source (task/invoice) | Web: dedicated sidebar page (see §2) rather than a dropdown, since it's a first-class destination on both platforms |

## 4. Design System Basics

Tokens are shared across platforms — this is the mechanism that keeps two separately-coded frontends feeling like one product (per PRD §5: no shared component code, but a shared design language).

| Token | Value (starting point) |
|---|---|
| Primary color | Blue 600 (e.g. `#2563EB`) |
| Success (done/active) | Green 600 |
| Warning (due soon/past_due) | Amber 500 |
| Danger (overdue/canceled) | Red 600 |
| Font | System default per platform (San Francisco/Roboto on mobile, system font stack on web) — no custom web font in MVP to keep load time down |
| Spacing scale | 4/8/12/16/24/32 px |
| Corner radius | 8px cards, 999px pills for badges |
| Mobile component library | NativeWind (Tailwind for React Native) |
| Web component library | Tailwind CSS directly (Next.js's default styling approach), same spacing/color scale as NativeWind's config so the token values genuinely match, not just resemble each other |

## 5. Status Badge Conventions

Identical on both platforms:

- Task: `open` gray · `in_progress` blue · `done` green · `canceled` red (strikethrough)
- Subscription: `trialing` amber · `active` green · `past_due` red · `canceled` gray
- Overdue task: red due-date text + bell icon

## 6. Accessibility Notes

- Mobile: minimum touch target 44x44pt
- Web: minimum interactive target 24x24px (WCAG 2.1 AA), visible focus rings for keyboard navigation (a mobile-only design has no equivalent requirement, so this is a genuinely new consideration for the web build)
- Color is never the only status signal — always paired with text/icon, on both platforms
- Mobile: support system font scaling (no fixed-height text containers for critical copy)
- Web: support browser zoom to 200% without loss of content/functionality

## 7. Phase 2 (not MVP, either platform)

- Dark mode
- Client-facing portal (invoices, service status) — the Client role exists in the permission matrix but has no dedicated screens yet on either platform
- Native desktop app — explicitly not planned; the web app's responsive layout is the answer for "I want this on my computer" (see PRD §5)
