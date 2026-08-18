-- Keywords were never part of the full-text index, so generated descriptive terms such
-- as "portrait" or "glasses" could not be matched by a text query.
--
-- A generated column cannot be used here because array_to_string is STABLE rather than
-- IMMUTABLE, so the vector is maintained by a trigger instead.
drop index if exists public.files_search_vector_idx;

alter table public.files drop column if exists search_vector;

alter table public.files add column search_vector tsvector;

create or replace function public.files_search_vector_refresh()
returns trigger
language plpgsql
set search_path to 'public', 'extensions'
as $function$
begin
    new.search_vector :=
        setweight(to_tsvector('english'::regconfig, coalesce(new.file_name, '')), 'A')
        || setweight(to_tsvector('english'::regconfig, coalesce(new.title, '')), 'A')
        || setweight(to_tsvector('english'::regconfig, coalesce(new.subject, '')), 'B')
        || setweight(to_tsvector('english'::regconfig, coalesce(new.unit, '')), 'B')
        || setweight(to_tsvector('english'::regconfig, coalesce(array_to_string(new.keywords, ' '), '')), 'B')
        || setweight(to_tsvector('english'::regconfig, coalesce(new.summary, '')), 'C');
    return new;
end;
$function$;

drop trigger if exists files_search_vector_trg on public.files;

create trigger files_search_vector_trg
    before insert or update on public.files
    for each row execute function public.files_search_vector_refresh();

-- Populate the vector for rows that already exist.
update public.files set updated_at = updated_at;

create index files_search_vector_idx on public.files using gin (search_vector);
