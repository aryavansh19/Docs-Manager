alter table public.profiles
    add constraint profiles_phone_canonical_check
    check (phone is null or phone ~ '^[0-9]{10,15}$') not valid;
alter table public.profiles validate constraint profiles_phone_canonical_check;

create or replace function public.renew_ingestion_lease(
    p_job_id uuid,
    p_lease_token uuid,
    p_minutes integer default 30
)
returns boolean
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
    changed integer;
begin
    update public.ingestion_jobs
    set lease_expires_at = now() + make_interval(mins => least(greatest(p_minutes, 5), 120)),
        updated_at = now()
    where id = p_job_id
      and lease_token = p_lease_token
      and status = 'processing';
    get diagnostics changed = row_count;
    return changed = 1;
end;
$$;
revoke all on function public.renew_ingestion_lease(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.renew_ingestion_lease(uuid, uuid, integer) to service_role;
