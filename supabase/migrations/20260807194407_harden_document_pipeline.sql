create unique index if not exists profiles_phone_unique_idx on public.profiles (phone) where phone is not null;

alter table public.files
    add column if not exists extraction_status text not null default 'complete',
    add column if not exists extraction_error text;

alter table public.ingestion_jobs
    add column if not exists lease_token uuid,
    add column if not exists lease_expires_at timestamptz;
create index if not exists ingestion_jobs_lease_idx on public.ingestion_jobs (status, lease_expires_at, created_at)
    where status in ('queued', 'processing', 'failed');

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
    if exists (select 1 from public.profiles where phone = digits and id <> uid) then
        return jsonb_build_object('success', false, 'error', 'phone_in_use');
    end if;

    select status into existing_status from public.profiles where id = uid;
    final_status := case
        when existing_status in ('CONNECTED','AWAITING_SYLLABUS','EDITING_LIST','AWAITING_FOLDERS','ACTIVE') then existing_status
        else 'NEW'
    end;

    insert into public.profiles as p (id, name, phone, avatar_url, status, google_token, whatsapp_verified)
    values (
        uid, user_name, digits, user_pic, final_status,
        case when google_refresh_token is null then null else jsonb_build_object('refresh_token', google_refresh_token) end,
        false
    )
    on conflict (id) do update set
        name = coalesce(excluded.name, p.name),
        phone = excluded.phone,
        avatar_url = coalesce(excluded.avatar_url, p.avatar_url),
        status = final_status,
        google_token = case when google_refresh_token is not null then excluded.google_token else p.google_token end,
        whatsapp_verified = case when p.phone is distinct from excluded.phone then false else p.whatsapp_verified end;

    select status, whatsapp_verified, root_folder_id into rec from public.profiles where id = uid;
    return jsonb_build_object(
        'success', true,
        'status', rec.status,
        'whatsapp_verified', coalesce(rec.whatsapp_verified, false),
        'has_workspace', rec.root_folder_id is not null
    );
exception when unique_violation then
    return jsonb_build_object('success', false, 'error', 'phone_in_use');
end;
$$;

create or replace function public.claim_ingestion_job(p_job_id uuid default null)
returns setof public.ingestion_jobs
language plpgsql
security invoker
set search_path = public, extensions, pg_temp
as $$
begin
    return query
    with candidate as (
        select job.id
        from public.ingestion_jobs job
        where job.attempt_count < 3
          and (p_job_id is null or job.id = p_job_id)
          and (
              job.status in ('queued', 'failed')
              or (job.status = 'processing' and (job.lease_expires_at is null or job.lease_expires_at < now()))
          )
        order by job.created_at
        for update skip locked
        limit 1
    )
    update public.ingestion_jobs job
    set status = 'processing',
        attempt_count = job.attempt_count + 1,
        last_error = null,
        lease_token = gen_random_uuid(),
        lease_expires_at = now() + interval '30 minutes',
        updated_at = now()
    from candidate
    where job.id = candidate.id
    returning job.*;
end;
$$;
revoke all on function public.claim_ingestion_job(uuid) from public, anon, authenticated;
grant execute on function public.claim_ingestion_job(uuid) to service_role;

drop function if exists public.hybrid_search_files(uuid, text, extensions.vector, integer, integer);
create function public.hybrid_search_files(
    p_user_id uuid,
    p_query text,
    p_query_embedding extensions.vector(384),
    p_match_count integer default 10,
    p_rrf_k integer default 50
)
returns table (
    id uuid,
    drive_file_id text,
    file_name text,
    folder_id text,
    subject text,
    unit text,
    title text,
    summary text,
    document_type text,
    mime_type text,
    tags jsonb,
    keywords text[],
    relevance double precision,
    matched_excerpt text
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
with query_data as (
    select websearch_to_tsquery('english'::regconfig, nullif(trim(p_query), '')) as tsq
),
full_text_scored as (
    select
        f.id as file_id,
        greatest(ts_rank_cd(f.search_vector, q.tsq), coalesce(max(ts_rank_cd(dc.search_vector, q.tsq)), 0))::double precision as score
    from public.files f
    cross join query_data q
    left join public.document_chunks dc on dc.file_id = f.id
    where f.user_id = p_user_id
      and q.tsq is not null
      and (f.search_vector @@ q.tsq or dc.search_vector @@ q.tsq)
    group by f.id, f.search_vector, q.tsq
    order by score desc
    limit least(greatest(p_match_count * 4, 20), 80)
),
full_text as (
    select file_id, score, row_number() over (order by score desc) as rank_ix from full_text_scored
),
semantic_candidates as (
    (select f.id as file_id, (1 - (f.embedding <=> p_query_embedding))::double precision as score
     from public.files f
     where f.user_id = p_user_id and p_query_embedding is not null and f.embedding is not null
     order by f.embedding <=> p_query_embedding
     limit least(greatest(p_match_count * 4, 20), 80))
    union all
    (select dc.file_id, (1 - (dc.embedding <=> p_query_embedding))::double precision as score
     from public.document_chunks dc
     where dc.user_id = p_user_id and p_query_embedding is not null and dc.embedding is not null
     order by dc.embedding <=> p_query_embedding
     limit least(greatest(p_match_count * 4, 20), 80))
),
semantic_scored as (
    select file_id, max(score) as score from semantic_candidates group by file_id having max(score) >= 0.50
),
semantic as (
    select file_id, score, row_number() over (order by score desc) as rank_ix from semantic_scored
),
fuzzy_scored as (
    select
        f.id as file_id,
        greatest(
            similarity(coalesce(f.file_name, ''), p_query),
            similarity(coalesce(f.title, ''), p_query),
            similarity(coalesce(f.subject, ''), p_query),
            similarity(coalesce(f.unit, ''), p_query)
        )::double precision as score
    from public.files f
    where f.user_id = p_user_id and nullif(trim(p_query), '') is not null
    order by score desc
    limit least(greatest(p_match_count * 4, 20), 80)
),
fuzzy as (
    select file_id, score, row_number() over (order by score desc) as rank_ix from fuzzy_scored where score >= 0.25
),
fused as (
    select
        coalesce(ft.file_id, se.file_id, fu.file_id) as file_id,
        coalesce(1.0 / (p_rrf_k + ft.rank_ix), 0.0) * 1.25
        + coalesce(1.0 / (p_rrf_k + se.rank_ix), 0.0)
        + coalesce(1.0 / (p_rrf_k + fu.rank_ix), 0.0) * 0.75 as fusion_score,
        greatest(
            case when ft.file_id is not null then least(1.0, 0.60 + ft.score) else 0.0 end,
            coalesce(se.score, 0.0),
            coalesce(fu.score, 0.0)
        ) as confidence
    from full_text ft
    full outer join semantic se on se.file_id = ft.file_id
    full outer join fuzzy fu on fu.file_id = coalesce(ft.file_id, se.file_id)
)
select
    f.id, f.drive_file_id, f.file_name, f.folder_id, f.subject, f.unit, f.title, f.summary,
    f.document_type, f.mime_type, f.tags, f.keywords,
    fused.confidence::double precision as relevance,
    coalesce(
        (select left(dc.content, 280)
         from public.document_chunks dc, query_data q
         where dc.file_id = f.id
         order by
             case when q.tsq is not null then ts_rank_cd(dc.search_vector, q.tsq) else 0 end desc,
             case when p_query_embedding is not null and dc.embedding is not null then dc.embedding <=> p_query_embedding else 2 end
         limit 1),
        left(f.summary, 280)
    ) as matched_excerpt
from fused
join public.files f on f.id = fused.file_id
where f.user_id = p_user_id
order by fused.fusion_score desc, fused.confidence desc, f.created_at desc
limit least(greatest(p_match_count, 1), 30);
$$;
grant execute on function public.hybrid_search_files(uuid, text, extensions.vector, integer, integer) to authenticated, service_role;

do $$
begin
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'files'
    ) then
        alter publication supabase_realtime add table public.files;
    end if;
end;
$$;
