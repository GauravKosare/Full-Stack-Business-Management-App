# Solstice — Business Management Platform

A full-stack, multi-tenant business management platform: role-based team hierarchies, task delegation with proof-of-completion uploads, company/department/DM chat with realtime delivery, performance reviews, and subscription billing. Built as a production web app (Next.js) and companion mobile app (Expo/React Native) sharing one Express + PostgreSQL API.

**Live demo:** [full-stack-business-management-app.vercel.app](https://full-stack-business-management-app.vercel.app)

Sign in with Google, or explore a fully-seeded demo company (owner, 2 directors, 4 managers, 3 project heads, 8 employees, real departments, channels, and 19 in-progress/completed tasks — including uploaded proof documents) using:

| Email | Password |
|---|---|
| `priya.sharma@example.com` (Director, Engineering) | `Solstice#Demo2026` |
| `karan.malhotra@example.com` (Manager, Sales) | `Solstice#Demo2026` |
| `vikram.nair@example.com` (Project Head, Engineering) | `Solstice#Demo2026` |
| `rahul.verma@example.com` (Employee, Engineering) | `Solstice#Demo2026` |

Any of the seeded accounts work with the same password — sign in and switch roles to see how visibility and permissions change across the org chart.

## What it does

- **Role-based org hierarchy** — Owner → Director → Manager → Project Head → Employee. Every action (inviting a member, assigning a task, creating a channel) is authorized against this rank, enforced server-side, not just hidden in the UI.
- **Task delegation with proof of completion** — tasks can require a signed-off completion: a short description, and optionally a document (PDF, Office file, image — never video, capped at 5MB) uploaded directly to private object storage via short-lived signed URLs.
- **Team chat** — auto-managed company and department channels, ad-hoc custom channels, and 1:1 DMs, with realtime message delivery.
- **Performance reviews, billing & invoicing** — Razorpay-backed subscriptions, invoice history, and structured performance reviews tied to task completion/on-time rates.
- **Google OAuth + email/password auth**, shared across both the web and mobile clients through the same JWT-based API.

## Architecture

```
web/     Next.js 15 (React 19) — the primary web client
mobile/  Expo / React Native — companion mobile client
api/     Express + TypeScript — REST API shared by both clients
```

- **Database:** PostgreSQL (Supabase), accessed via Prisma migrations. Row Level Security is enabled with a default-deny policy on every table — the API's database role bypasses RLS, so a leaked/extracted public client key can't read or write anything directly.
- **File storage:** Supabase Storage, private bucket, enforced at three independent layers (client validation, server validation, bucket-level size/MIME allowlist) — client uploads go straight to signed URLs, never through the API's own request body.
- **Realtime:** Supabase Broadcast for live chat delivery, with polling as an automatic fallback.
- **Auth:** Google OAuth2 and email/password, both exchanged for a short-lived JWT via a one-time-code handshake — no long-lived tokens ever touch a URL or browser history.
- **Deployment:** Vercel (web + API as serverless functions), Supabase (Postgres, Storage, Realtime) — entirely on free tiers.

## Tech stack

**Frontend:** Next.js, React, TypeScript, Tailwind CSS
**Mobile:** Expo, React Native, NativeWind
**Backend:** Node.js, Express, TypeScript, Prisma, Zod
**Data & infra:** PostgreSQL, Supabase (Auth-adjacent storage/realtime), Vercel
**Integrations:** Google OAuth2, Razorpay (billing), Brevo (transactional email)

## Running locally

```bash
npm install

# api/.env — copy from api/.env.example and fill in DATABASE_URL, JWT_SECRET, etc.
npm run dev --workspace api

# web/.env.local — point at the local API
npm run dev --workspace web
```

See [`api/.env.example`](api/.env.example) for the full list of environment variables and which features degrade gracefully when a given integration isn't configured (Google auth, Razorpay, realtime chat, and file storage are all optional — the app runs without them).
