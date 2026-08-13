# Workflow

How the pieces actually connect, end to end — request flow, auth flow, and the development/deployment workflow.

## Request flow (web/mobile → API → database)

```
web (Next.js)  ─┐
                 ├──►  api (Express, Vercel serverless)  ──►  PostgreSQL (Supabase, via Prisma)
mobile (Expo)   ─┘                                        └─►  Supabase Storage (file proofs)
                                                            └─►  Supabase Realtime (chat broadcast)
```

Both clients talk to the **same** Express API over plain HTTPS/JSON — there's no client-specific backend logic. The API is the only thing that ever talks to Postgres (via Prisma) or holds the Supabase **service role** key; the clients only ever hold a public anon key, used solely for realtime listening and pre-signed file PUTs.

## Auth flow

1. Client requests `/api/v1/auth/google?platform=web|mobile` (or posts to `/auth/signup` / `/auth/login` for email+password).
2. For Google: the API sets a CSRF `state` cookie, redirects to Google, and on callback verifies the state, then creates a **single-use, 60-second code** (not the JWT itself) and redirects the client to it with that code in the URL.
3. The client immediately calls `POST /api/v1/auth/exchange` with the code, over a direct HTTPS request (not a URL), and receives the real JWT in the response body.
4. Every subsequent request carries the JWT as `Authorization: Bearer <token>`; `requireAuth` middleware verifies it and attaches `req.userId`.

The one-time-code indirection exists so a long-lived JWT never sits in a redirect URL — not in browser history, not in a `Referer` header, not in server access logs.

## Authorization flow (per request)

Most routes follow the same shape:

1. `requireAuth` — verifies the JWT, resolves `req.userId`.
2. `requireRole(...)` (where relevant) — checks the caller's `BusinessMember.role` for this business is in an allowed set (e.g. `STAFF_MANAGING_ROLES` for anyone who can create tasks/invite people).
3. A route-specific check against `outranks()` / `canAddToChannel()` (`api/src/lib/roles.ts`) — confirms the caller's rank strictly exceeds every target user's rank, for the specific action being taken (invite, task-assign, channel-add each have slightly different rules — see [PRODUCT.md](PRODUCT.md)).
4. The Prisma query itself is always scoped to the business/task/channel in the URL, not just the global ID — closing the IDOR gap where a valid-but-wrong-business ID would otherwise still resolve.

## Task completion (proof-of-work) flow

```
Assignee clicks "Mark done"
        │
        ▼
Modal asks for a description (always) + a file (only if the task requires proof)
        │
        ▼
If a file is attached:
  1. POST /tasks/:id/proof-upload-url  → API validates size/MIME, returns a short-lived signed URL
  2. Browser PUTs the file directly to Supabase Storage (bypasses the API entirely —
     sidesteps Vercel's serverless request-body size limit)
        │
        ▼
PATCH /tasks/:id/status { status: "done", completionDescription, proofPath, ... }
  → API re-validates everything server-side (never trusts the client-side checks alone)
  → upserts a TaskCompletionProof row
```

Reading a proof back later issues a fresh 60-second signed *download* URL on demand — nothing about the file is ever public.

## Development workflow

```bash
git clone <repo>
npm install                          # installs all three workspaces (api, web, mobile)

# api/.env — copy from api/.env.example, fill in DATABASE_URL + JWT_SECRET at minimum
npm run prisma:migrate --workspace api   # applies migrations to your local/dev database
npm run dev --workspace api              # http://localhost:3000

# web/.env.local — copy from web/.env.local.example
npm run dev --workspace web               # http://localhost:3001

# mobile/.env — copy from mobile/.env.example
npm run start --workspace mobile          # Expo dev server
```

Full environment variable reference and deployment steps live in the root [README](../README.md#environment-variables) and [README](../README.md#deployment).

## Database change workflow

Schema changes always go through Prisma, never hand-written SQL against production:

1. Edit `api/prisma/schema.prisma`.
2. `npx prisma migrate dev --name <description>` locally — generates a migration file under `api/prisma/migrations/` and applies it to your dev database.
3. Commit the generated migration folder.
4. In production, `prisma migrate deploy` (or, as used during this project's development, applying the same SQL directly via the Supabase migration tool and then `prisma migrate resolve --applied` locally to keep the migration history in sync) applies it to the live database.

## CI/deploy workflow

There's no separate CI pipeline — Vercel builds and deploys directly from git:

1. Push to `main`.
2. Vercel picks up the push for both the `web` and `api` projects (each configured with its own root directory in the Vercel dashboard) and runs their respective build commands (`next build` for web, `tsc` + `prisma generate` for the API — see `vercel-build` in `api/package.json`).
5. A deploy is live within roughly a minute; `GET /health` on the API reports which optional integrations (Google auth, Razorpay, realtime, storage) are actually configured on that deployment, which is the fastest way to confirm an environment variable landed correctly after a deploy.
