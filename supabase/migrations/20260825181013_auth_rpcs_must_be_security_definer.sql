-- Companion to 20260819071500_restrict_profile_column_privileges.sql, and required by it.
--
-- link_google_account and get_user_status_by_email write privileged columns
-- (phone, status, google_token, whatsapp_verified). Both were SECURITY INVOKER, so they
-- executed with the caller's privileges. The moment those columns were revoked from
-- `authenticated`, the upsert in link_google_account and the token refresh in
-- get_user_status_by_email began failing with insufficient_privilege — which breaks
-- signup and login outright.
--
-- INVOKER was only viable while `authenticated` held blanket UPDATE on profiles, i.e. only
-- while the privilege escalation existed. DEFINER is the correct mode for a privileged
-- write performed on the caller's behalf:
--
--   * each function resolves auth.uid() itself and rejects an unauthenticated caller
--   * every read and write is scoped to `where id = uid`, so no cross-user access
--   * both pin `search_path`, so they cannot be hijacked via a shadowed schema
--   * neither returns google_token in its result payload
--
-- Only the security mode changes here; the bodies are untouched.
alter function public.link_google_account(text, text, text, text) security definer;
alter function public.get_user_status_by_email(text) security definer;
alter function public.get_user_status_by_email() security definer;
