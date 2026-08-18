create or replace function public.link_google_account(
    target_phone text,
    google_refresh_token text default null,
    user_name text default null,
    user_pic text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    uid uuid := auth.uid();
    digits text;
    existing_status text;
    final_status text;
    rec record;
begin
    if uid is null then
        return jsonb_build_object('success', false, 'error', 'not_authenticated');
    end if;
    digits := regexp_replace(coalesce(target_phone, ''), '\D', '', 'g');
    if length(digits) < 10 then
        return jsonb_build_object('success', false, 'error', 'invalid_phone');
    end if;
    select status into existing_status from public.profiles where id = uid;
    final_status := case
        when existing_status in ('CONNECTED','AWAITING_SYLLABUS','EDITING_LIST','AWAITING_FOLDERS','ACTIVE') then existing_status
        else 'NEW'
    end;
    insert into public.profiles as p (id, name, phone, avatar_url, status, google_token)
    values (
        uid, user_name, digits, user_pic, final_status,
        case when google_refresh_token is null then null else jsonb_build_object('refresh_token', google_refresh_token) end
    )
    on conflict (id) do update set
        name = coalesce(excluded.name, p.name),
        phone = excluded.phone,
        avatar_url = coalesce(excluded.avatar_url, p.avatar_url),
        status = final_status,
        google_token = case when google_refresh_token is not null then excluded.google_token else p.google_token end;
    select status, whatsapp_verified, root_folder_id into rec from public.profiles where id = uid;
    return jsonb_build_object(
        'success', true,
        'status', rec.status,
        'whatsapp_verified', coalesce(rec.whatsapp_verified, false),
        'has_workspace', rec.root_folder_id is not null
    );
end;
$$;

create or replace function public.get_user_status_by_email()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    uid uuid := auth.uid();
    user_email text;
    rec record;
begin
    if uid is null then
        return jsonb_build_object('success', false, 'error', 'not_authenticated');
    end if;
    select email into user_email from auth.users where id = uid;
    select status, whatsapp_verified, root_folder_id into rec from public.profiles where id = uid;
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

grant execute on function public.link_google_account(text, text, text, text) to authenticated, service_role;
grant execute on function public.get_user_status_by_email() to authenticated, service_role;
