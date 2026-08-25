-- Row Level Security decided WHICH ROWS a signed-in user could touch, but never WHICH
-- COLUMNS. The profiles policies allow any authenticated user to update their own row,
-- so from the browser console it was possible to run:
--
--     update profiles set whatsapp_verified = true, status = 'ACTIVE' where id = <own id>
--
-- That bypasses WhatsApp ownership verification entirely. Worse, phone was writable too:
-- an attacker could claim a number belonging to someone who had not signed up yet, mark
-- it verified, and once that person messaged the bot their documents would have been
-- filed into the attacker's Google Drive.
--
-- Privileges are the right tool here rather than policies, because the problem is column
-- scope, not row scope. service_role is untouched, so the backend keeps full access.

-- 1. Writes: hand back only the fields a user may safely set on themselves.
revoke update on public.profiles from authenticated, anon;
grant update (name, avatar_url) on public.profiles to authenticated;

-- 2. Reads: google_token holds a long-lived Google refresh token. The browser never needs
-- it, yet `select("*")` on the dashboard shipped it to the client on every load, where any
-- XSS or hostile extension could lift it. Every other column stays readable.
-- Enumerated dynamically so a future column is exposed deliberately, not by omission.
do $$
declare
    column_name text;
begin
    revoke select on public.profiles from authenticated, anon;
    for column_name in
        select c.column_name
        from information_schema.columns c
        where c.table_schema = 'public'
          and c.table_name = 'profiles'
          and c.column_name <> 'google_token'
        order by c.ordinal_position
    loop
        execute format(
            'grant select (%I) on public.profiles to authenticated', column_name
        );
    end loop;
end $$;

-- 3. The setup screen legitimately stages a parsed syllabus and advances the status. That
-- was the only browser-side write of a privileged column, so it moves behind a function
-- that validates the transition instead of trusting the client.
create or replace function public.save_syllabus_draft(subjects jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    uid uuid := auth.uid();
begin
    if uid is null then
        return jsonb_build_object('success', false, 'error', 'not_authenticated');
    end if;

    if subjects is null or jsonb_typeof(subjects) <> 'array' then
        return jsonb_build_object('success', false, 'error', 'invalid_payload');
    end if;

    -- Reachable only from the pre-workspace states. ACTIVE is deliberately excluded: it
    -- requires a verified WhatsApp number and a real Drive folder tree, both of which are
    -- established server side.
    update public.profiles
    set temp_syllabus_list = subjects,
        status = 'AWAITING_FOLDERS'
    where id = uid
      and status in ('NEW', 'PENDING', 'CONNECTED', 'AWAITING_SYLLABUS', 'EDITING_LIST', 'AWAITING_FOLDERS');

    if not found then
        return jsonb_build_object('success', false, 'error', 'invalid_state');
    end if;

    return jsonb_build_object('success', true);
end;
$$;

revoke all on function public.save_syllabus_draft(jsonb) from public, anon;
grant execute on function public.save_syllabus_draft(jsonb) to authenticated;
