import { createClient } from "@supabase/supabase-js";

// Public by design — the anon key is meant to be exposed client-side (same posture as
// the DATABASE_URL/API_URL fallback pattern elsewhere in lib/) — it authorizes nothing
// on its own. The browser only ever *listens* for broadcast events here; every read/
// write of actual chat data goes through our own authenticated API (lib/api.ts), never
// straight to Supabase.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://onkycwbfwrddmnbcoqun.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ua3ljd2Jmd3JkZG1uYmNvcXVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY1MzM5MjMsImV4cCI6MjEwMjEwOTkyM30.r1nZ4AS1FxBbGaVUKPbhDYmuQ9RTs-ltvxK1HqLQBWk";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
