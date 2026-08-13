# Tech Stack

A breakdown of every technology used in the project and why it was chosen.

## Frontend — Web (`web/`)

| Technology | Purpose |
|---|---|
| [Next.js 15](https://nextjs.org/) (App Router) | React framework — file-based routing, server/client component split, production build pipeline |
| [React 19](https://react.dev/) | UI library |
| TypeScript | Type safety across the whole client |
| [Tailwind CSS](https://tailwindcss.com/) | Utility-first styling, no separate CSS files per component |
| `@supabase/supabase-js` | Thin client used only for realtime broadcast listening and pre-signed file uploads — never for direct data access (see [PRODUCT.md](PRODUCT.md) and the README's RLS note) |

## Mobile (`mobile/`)

| Technology | Purpose |
|---|---|
| [Expo](https://expo.dev/) (SDK 57) | React Native tooling, OTA-friendly build/dev workflow |
| React Native 0.86 | Cross-platform native UI |
| [NativeWind](https://www.nativewind.dev/) | Tailwind syntax on top of React Native's StyleSheet |
| React Navigation (native-stack + bottom-tabs) | App navigation |
| `expo-linking` / `expo-web-browser` | Handles the OAuth redirect flow back into the app via a custom URL scheme |

## Backend (`api/`)

| Technology | Purpose |
|---|---|
| [Express](https://expressjs.com/) | HTTP framework |
| TypeScript | Type safety, compiled with `tsc` for production |
| [Prisma](https://www.prisma.io/) | ORM + migration system — schema lives in `api/prisma/schema.prisma`, migrations are checked into git |
| [Zod](https://zod.dev/) | Request body/query validation on every route |
| `passport` + `passport-google-oauth20` | Google OAuth2 strategy |
| `jsonwebtoken` | Signs/verifies the short-lived auth JWT |
| `bcryptjs` | Password hashing for email/password accounts |
| `pino` / `pino-http` | Structured request logging |
| `razorpay` | Billing/subscriptions integration (test-mode by default) |
| `cors`, `cookie-parser` | Standard Express middleware |

## Data & infrastructure

| Technology | Purpose |
|---|---|
| PostgreSQL (via [Supabase](https://supabase.com/)) | Primary datastore, accessed exclusively through Prisma from the API — Row Level Security is enabled with a default-deny policy on every table (see the README) |
| Supabase Storage | Private object storage for task-completion proof documents — signed upload/download URLs only, nothing public |
| Supabase Realtime (Broadcast) | Live chat message delivery, with client-side polling as an automatic fallback when unconfigured |
| [Vercel](https://vercel.com/) | Hosting for both the web app and the API (as a serverless function) |

## Third-party integrations

| Service | Used for | Required? |
|---|---|---|
| Google OAuth2 | "Sign in with Google" | Optional — email/password auth works without it |
| [Razorpay](https://razorpay.com/) | Subscription billing, invoices, webhooks | Optional — billing routes 501 gracefully if unconfigured |
| [Brevo](https://www.brevo.com/) (formerly Sendinblue) | Transactional invite emails | Optional — invites still work, just without an email being sent |

## Why this stack

- **One language, one repo, three targets** — TypeScript end-to-end (API, web, mobile) sharing the same mental model of the data, with Prisma's generated types as the single source of truth for shapes crossing the network boundary.
- **Everything on a free tier** — Vercel's Hobby plan + Supabase's free project cover hosting, database, file storage, and realtime with no paid infrastructure, which shaped several decisions directly (e.g. direct-to-Supabase-Storage signed uploads to route around Vercel's serverless request-body size ceiling instead of proxying uploads through the API).
- **Server-enforced authorization, not just UI-hidden** — every role/rank check (who can invite whom, who can assign a task to whom, who can see what) is enforced in the Express route handlers via Zod-validated input and Prisma queries scoped to the caller, so the API is safe to call directly, not just safe behind the UI.
