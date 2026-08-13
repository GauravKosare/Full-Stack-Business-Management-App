# Product Description

## What this is

A multi-tenant business management platform for small-to-mid-size companies to run their internal team structure, task delegation, and communication in one place — think a lightweight combination of an org chart, a Trello-style task board with accountability built in, and Slack, scoped specifically to how a real company's chain of command actually works.

A user can create a **business** (a company/workspace), invite people into it with a specific **role**, organize them into **departments**, delegate **tasks** down the chain of command, and communicate through auto-managed **chat channels** — all while every permission in the system is derived from where someone sits in the org chart, not from a flat "admin/user" split.

## Who it's for

Small businesses, agencies, or teams who want structured task ownership and accountability (a task has a creator and an assignee, and completing it can require a description of *how* it was done plus evidence, not just a checkbox) without adopting a heavyweight enterprise tool.

## The org hierarchy

Every business has exactly one **Owner** (whoever created it) and then a delegation chain below them:

```
Owner
 └─ Director
     └─ Manager
         └─ Project Head
             └─ Employee
```

The rule that drives almost everything in the app: **you can only invite, assign tasks to, or otherwise act on people strictly below your own rank.** A Manager can bring on a Project Head or an Employee, but never another Manager, a Director, or the Owner. This is enforced in the API itself (`api/src/lib/roles.ts`), so it can't be bypassed by calling the API directly — the UI just reflects what the API will actually allow.

Departments (Engineering, Sales, Marketing, Support, etc.) are a separate, free-text label layered on top of role — they drive channel membership and visibility, but not authorization.

## Core features

### Team & org management
- Invite members by email into a specific role and department; re-inviting an existing member is also how you change their role.
- A directory/visibility model where the Owner sees everyone, and everyone else sees their own department plus same-rank peers company-wide (Director/Manager only) — enough to collaborate, not a full company-wide roster for an Employee.

### Task delegation
- Create a task, optionally give it a due date and priority, and assign it to one or more people you outrank.
- **Proof of completion** — a task can be marked as requiring proof. Completing any task always requires a short description of how it was done; a proof-required task also needs a supporting document uploaded (PDF, Word, Excel, plain text, or image — explicitly never video — capped at 5MB). This turns "done" from a self-reported checkbox into an auditable record with an actual attached file.
- Tasks are only visible to their creator and their assignees (plus the Owner, who sees everything) — not the whole company.

### Team chat
- Every business automatically gets a **company channel** (everyone) and one **department channel** per department, membership on both auto-derived from who's actually on the team — no manual channel administration.
- **Custom channels** can be created ad hoc by anyone above Employee rank, with an explicit member list (rules here are slightly more permissive than task assignment — you can add peers and even one rank above yourself, since coordination isn't a strict chain-of-command activity).
- **Direct messages** between any two members of the same business.
- Messages deliver in realtime via Supabase Broadcast, falling back to polling automatically if realtime isn't configured for a given deployment.

### Performance & billing
- Structured performance reviews tied to a review period, task completion rate, and on-time rate.
- Subscription billing via Razorpay (free/pro/enterprise plans), with invoice history per business.

### Notifications
- In-app notifications for invites, task assignment, task completion, and channel invites.

## Design philosophy

- **Authorization lives in the API, not the UI.** Every rank/role check is re-verified server-side on every request — the frontend hiding a button is a UX nicety, never the actual security boundary.
- **"Done" means something.** Completing a task is a deliberate action that records how and (optionally) with what evidence — not a silent status flip.
- **Free-tier-first.** Every integration (storage, realtime, email, billing) is optional and degrades gracefully when unconfigured, and every architectural choice was made to fit comfortably inside Vercel's and Supabase's free tiers — see [TECH_STACK.md](TECH_STACK.md).

## Try it

Live demo: **https://full-stack-business-management-app.vercel.app** — see the root [README](../README.md) for demo login credentials spanning every role in the hierarchy.
