-- This app has no Supabase Auth session and no direct client access to Postgres/PostgREST
-- by design: every read/write goes through the Express API (api/src/*), which connects
-- via DATABASE_URL as the `postgres` role — a role with BYPASSRLS, so enabling RLS here
-- does not affect the API at all. The web app only ever uses the (publicly-exposed) anon
-- key to *listen* for realtime broadcast events (web/lib/supabase.ts) and to PUT files to
-- pre-signed Storage URLs — neither requires any table grants.
--
-- Enabling RLS with zero policies makes every one of these tables default-deny for the
-- anon/authenticated roles PostgREST exposes, closing off direct table access via a
-- leaked/extracted anon key while leaving the trusted API path untouched.

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._prisma_migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_completion_proofs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.users FORCE ROW LEVEL SECURITY;
ALTER TABLE public.businesses FORCE ROW LEVEL SECURITY;
ALTER TABLE public.business_members FORCE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.invoices FORCE ROW LEVEL SECURITY;
ALTER TABLE public.tasks FORCE ROW LEVEL SECURITY;
ALTER TABLE public.task_assignments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.performance_reviews FORCE ROW LEVEL SECURITY;
ALTER TABLE public.notifications FORCE ROW LEVEL SECURITY;
ALTER TABLE public._prisma_migrations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.channels FORCE ROW LEVEL SECURITY;
ALTER TABLE public.channel_members FORCE ROW LEVEL SECURITY;
ALTER TABLE public.messages FORCE ROW LEVEL SECURITY;
ALTER TABLE public.task_completion_proofs FORCE ROW LEVEL SECURITY;

-- Covering indexes for foreign keys the Supabase performance advisor flagged as
-- unindexed — these back joins the API already runs (listing a user's businesses/
-- memberships, a business's members, task/message/notification lookups by owner).
CREATE INDEX IF NOT EXISTS business_members_user_id_idx ON public.business_members (user_id);
CREATE INDEX IF NOT EXISTS businesses_owner_id_idx ON public.businesses (owner_id);
CREATE INDEX IF NOT EXISTS channel_members_user_id_idx ON public.channel_members (user_id);
CREATE INDEX IF NOT EXISTS invoices_business_id_idx ON public.invoices (business_id);
CREATE INDEX IF NOT EXISTS messages_sender_id_idx ON public.messages (sender_id);
CREATE INDEX IF NOT EXISTS notifications_business_id_idx ON public.notifications (business_id);
CREATE INDEX IF NOT EXISTS performance_reviews_business_id_idx ON public.performance_reviews (business_id);
CREATE INDEX IF NOT EXISTS performance_reviews_employee_id_idx ON public.performance_reviews (employee_id);
CREATE INDEX IF NOT EXISTS performance_reviews_reviewer_id_idx ON public.performance_reviews (reviewer_id);
CREATE INDEX IF NOT EXISTS task_assignments_user_id_idx ON public.task_assignments (user_id);
CREATE INDEX IF NOT EXISTS task_completion_proofs_user_id_idx ON public.task_completion_proofs (user_id);
CREATE INDEX IF NOT EXISTS tasks_created_by_idx ON public.tasks (created_by);
