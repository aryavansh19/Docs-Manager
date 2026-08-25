-- Lock the three browser-facing RPCs to signed-in callers.
--
-- Two problems showed up in the Supabase security advisors after the column-privilege work:
--
--   1. get_user_status_by_email existed as two overloads, () and (text default null).
--      The browser always calls it with the named google_refresh_token argument and the
--      backend never calls it at all, so the zero-argument version was dead code. Worse,
--      keeping both means PostgREST raises "function is not unique" for any call that
--      omits the argument.
--
--   2. Postgres grants EXECUTE to PUBLIC on new functions by default, so anon could reach
--      a SECURITY DEFINER function through /rest/v1/rpc/. Nothing leaked -- each function
--      returns 'not_authenticated' when auth.uid() is null -- but it is surface we do not
--      need, and it makes the advisor output noisy enough to hide a real finding later.

drop function if exists public.get_user_status_by_email();

revoke all on function public.get_user_status_by_email(text) from public;
revoke all on function public.get_user_status_by_email(text) from anon;
grant execute on function public.get_user_status_by_email(text) to authenticated, service_role;

revoke all on function public.link_google_account(text, text, text, text) from public;
revoke all on function public.link_google_account(text, text, text, text) from anon;
grant execute on function public.link_google_account(text, text, text, text) to authenticated, service_role;

revoke all on function public.save_syllabus_draft(jsonb) from public;
revoke all on function public.save_syllabus_draft(jsonb) from anon;
grant execute on function public.save_syllabus_draft(jsonb) to authenticated, service_role;
