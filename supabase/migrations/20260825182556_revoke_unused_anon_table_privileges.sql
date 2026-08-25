-- Drop the table privileges anon never uses.
--
-- anon held SELECT/INSERT/UPDATE/DELETE on every public table purely because that is the
-- Supabase default. Nothing uses it: the frontend calls supabase.auth.getUser() and bounces
-- to /login before touching any table, and the backend talks to Postgres as service_role.
--
-- anon could not actually read or write anything before this either, because RLS is on
-- everywhere and every policy is owner-scoped -- the files/document_chunks/search_feedback/
-- ingestion_jobs policies target the authenticated role explicitly, and the profiles policies
-- compare against auth.uid(), which is null for anon. But that safety rested entirely on the
-- policies. If a future policy is ever written 'to public' or 'using (true)', anon would
-- immediately inherit read access to every user's rows. Dropping the grant removes that
-- failure mode, so a policy mistake alone is no longer enough to expose data.
--
-- Verified afterwards against the live REST API with the publishable key: GET
-- /rest/v1/profiles and /rest/v1/files both return 401, where /rest/v1/files previously
-- returned 200 with an empty array.

revoke all on table public.profiles from anon;
revoke all on table public.files from anon;
revoke all on table public.document_chunks from anon;
revoke all on table public.ingestion_jobs from anon;
revoke all on table public.search_feedback from anon;
