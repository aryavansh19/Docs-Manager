alter function public.link_google_account(text, text, text, text) security invoker;

create or replace function public.get_user_status_by_email()
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
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

    return jsonb_build_object(
        'success', true,
        'status', coalesce(rec.status, 'NEW'),
        'whatsapp_verified', coalesce(rec.whatsapp_verified, false),
        'has_workspace', rec.root_folder_id is not null,
        'email', user_email
    );
end;
$$;
