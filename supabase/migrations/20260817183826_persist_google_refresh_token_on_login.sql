-- Google only returns a refresh token when consent is re-granted, and the login path
-- discarded it: get_user_status_by_email only read the profile. A revoked token could
-- therefore never be replaced by signing in again, leaving every Drive call failing.
--
-- The parameter is optional so existing zero-argument callers keep working.
create or replace function public.get_user_status_by_email(
    google_refresh_token text default null
)
returns jsonb
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
declare
    uid uuid := auth.uid();
    user_email text := auth.jwt() ->> 'email';
    rec record;
begin
    if uid is null then
        return jsonb_build_object('success', false, 'error', 'not_authenticated');
    end if;

    select status, whatsapp_verified, root_folder_id
    into rec
    from public.profiles
    where id = uid;

    if not found then
        return jsonb_build_object('success', false, 'error', 'account_not_found');
    end if;

    -- Refresh the stored credential whenever Google hands us a new one. Guarded so a
    -- sign-in that returns no token cannot erase a working one.
    if google_refresh_token is not null and length(trim(google_refresh_token)) > 20 then
        update public.profiles
        set google_token = jsonb_build_object('refresh_token', google_refresh_token)
        where id = uid;
    end if;

    return jsonb_build_object(
        'success', true,
        'status', coalesce(rec.status, 'NEW'),
        'whatsapp_verified', coalesce(rec.whatsapp_verified, false),
        'has_workspace', rec.root_folder_id is not null,
        'email', user_email
    );
end;
$function$;
