-- websearch_to_tsquery ANDs every term, so a natural request like "give a portrait"
-- parses to 'give' & 'portrait' and matches nothing because the filler verb appears in
-- no document. Switching to OR semantics lets any term match; ts_rank_cd still favours
-- documents matching more terms, and the cross-encoder discards weak candidates.
create or replace function public.hybrid_search_files(
    p_user_id uuid,
    p_query text,
    p_query_embedding vector,
    p_match_count integer default 10,
    p_rrf_k integer default 50,
    p_image_query_embedding vector default null
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
    visual_relevance double precision,
    matched_excerpt text
)
language sql
stable
set search_path to 'public', 'extensions'
as $function$
with query_data as (
    select nullif(
        replace(
            websearch_to_tsquery('english'::regconfig, coalesce(nullif(trim(p_query), ''), ''))::text,
            '&',
            '|'
        ),
        ''
    )::tsquery as tsq
),
full_text_scored as (
    select
        f.id as file_id,
        greatest(
            ts_rank_cd(f.search_vector, q.tsq),
            coalesce(max(ts_rank_cd(dc.search_vector, q.tsq)), 0)
        )::double precision as score
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
    select file_id, score, row_number() over (order by score desc) as rank_ix
    from full_text_scored
),
semantic_candidates as (
    (select f.id as file_id, (1 - (f.embedding <=> p_query_embedding))::double precision as score
     from public.files f
     where f.user_id = p_user_id
       and p_query_embedding is not null
       and f.embedding is not null
     order by f.embedding <=> p_query_embedding
     limit least(greatest(p_match_count * 4, 20), 80))
    union all
    (select dc.file_id, (1 - (dc.embedding <=> p_query_embedding))::double precision as score
     from public.document_chunks dc
     where dc.user_id = p_user_id
       and p_query_embedding is not null
       and dc.embedding is not null
     order by dc.embedding <=> p_query_embedding
     limit least(greatest(p_match_count * 4, 20), 80))
),
semantic_scored as (
    select file_id, max(score) as score
    from semantic_candidates
    group by file_id
    having max(score) >= 0.50
),
semantic as (
    select file_id, score, row_number() over (order by score desc) as rank_ix
    from semantic_scored
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
    where f.user_id = p_user_id
      and nullif(trim(p_query), '') is not null
    order by score desc
    limit least(greatest(p_match_count * 4, 20), 80)
),
fuzzy as (
    select file_id, score, row_number() over (order by score desc) as rank_ix
    from fuzzy_scored
    where score >= 0.25
),
visual_scored as (
    select
        f.id as file_id,
        (1 - (f.image_embedding <=> p_image_query_embedding))::double precision as score
    from public.files f
    where f.user_id = p_user_id
      and p_image_query_embedding is not null
      and f.image_embedding is not null
    order by f.image_embedding <=> p_image_query_embedding
    limit least(greatest(p_match_count * 4, 20), 80)
),
visual as (
    select file_id, score, row_number() over (order by score desc) as rank_ix
    from visual_scored
    where score >= 0.18
),
fused as (
    select
        coalesce(ft.file_id, se.file_id, fu.file_id, vi.file_id) as file_id,
        coalesce(1.0 / (p_rrf_k + ft.rank_ix), 0.0) * 1.25
        + coalesce(1.0 / (p_rrf_k + se.rank_ix), 0.0)
        + coalesce(1.0 / (p_rrf_k + fu.rank_ix), 0.0) * 0.75
        + coalesce(1.0 / (p_rrf_k + vi.rank_ix), 0.0) * 0.90 as fusion_score,
        greatest(
            case when ft.file_id is not null then least(1.0, 0.60 + ft.score) else 0.0 end,
            coalesce(se.score, 0.0),
            coalesce(fu.score, 0.0),
            coalesce(vi.score, 0.0)
        ) as confidence,
        coalesce(vi.score, 0.0) as visual_score
    from full_text ft
    full outer join semantic se on se.file_id = ft.file_id
    full outer join fuzzy fu on fu.file_id = coalesce(ft.file_id, se.file_id)
    full outer join visual vi on vi.file_id = coalesce(ft.file_id, se.file_id, fu.file_id)
)
select
    f.id,
    f.drive_file_id,
    f.file_name,
    f.folder_id,
    f.subject,
    f.unit,
    f.title,
    f.summary,
    f.document_type,
    f.mime_type,
    f.tags,
    f.keywords,
    fused.confidence::double precision as relevance,
    fused.visual_score::double precision as visual_relevance,
    coalesce(
        (select left(dc.content, 280)
         from public.document_chunks dc, query_data q
         where dc.file_id = f.id
         order by
             case when q.tsq is not null then ts_rank_cd(dc.search_vector, q.tsq) else 0 end desc,
             case when p_query_embedding is not null and dc.embedding is not null
                  then dc.embedding <=> p_query_embedding else 2 end
         limit 1),
        left(f.summary, 280)
    ) as matched_excerpt
from fused
join public.files f on f.id = fused.file_id
where f.user_id = p_user_id
order by fused.fusion_score desc, fused.confidence desc, f.created_at desc
limit least(greatest(p_match_count, 1), 30);
$function$;
