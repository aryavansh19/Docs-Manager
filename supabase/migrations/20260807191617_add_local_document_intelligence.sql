create extension if not exists vector with schema extensions;
create extension if not exists pg_trgm with schema extensions;

alter table public.files
    alter column user_id set not null,
    add column if not exists original_name text,
    add column if not exists mime_type text,
    add column if not exists size_bytes bigint,
    add column if not exists checksum text,
    add column if not exists document_type text,
    add column if not exists title text,
    add column if not exists summary text,
    add column if not exists keywords text[] not null default '{}',
    add column if not exists entities jsonb not null default '{}'::jsonb,
    add column if not exists unit text,
    add column if not exists extraction_method text,
    add column if not exists classification_confidence real,
    add column if not exists classification_status text not null default 'automatic',
    add column if not exists classification_candidates jsonb not null default '[]'::jsonb,
    add column if not exists embedding extensions.vector(384),
    add column if not exists updated_at timestamptz not null default now();

alter table public.files drop column if exists search_vector;
alter table public.files add column search_vector tsvector generated always as (
    setweight(to_tsvector('english'::regconfig, coalesce(file_name, '')), 'A') ||
    setweight(to_tsvector('english'::regconfig, coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english'::regconfig, coalesce(subject, '')), 'B') ||
    setweight(to_tsvector('english'::regconfig, coalesce(unit, '')), 'B') ||
    setweight(to_tsvector('english'::regconfig, coalesce(summary, '')), 'C')
) stored;

create unique index if not exists files_user_checksum_uidx on public.files (user_id, checksum) where checksum is not null;
create index if not exists files_search_vector_idx on public.files using gin (search_vector);
create index if not exists files_embedding_hnsw_idx on public.files using hnsw (embedding vector_cosine_ops);
create index if not exists files_file_name_trgm_idx on public.files using gin (file_name extensions.gin_trgm_ops);
create index if not exists files_title_trgm_idx on public.files using gin (title extensions.gin_trgm_ops);

create table if not exists public.document_chunks (
    id uuid primary key default gen_random_uuid(),
    file_id uuid not null references public.files(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    chunk_index integer not null check (chunk_index >= 0),
    page_number integer,
    content text not null check (char_length(content) > 0),
    embedding extensions.vector(384),
    search_vector tsvector generated always as (to_tsvector('english'::regconfig, content)) stored,
    created_at timestamptz not null default now(),
    unique (file_id, chunk_index)
);
create index if not exists document_chunks_file_idx on public.document_chunks (file_id, chunk_index);
create index if not exists document_chunks_user_idx on public.document_chunks (user_id);
create index if not exists document_chunks_search_vector_idx on public.document_chunks using gin (search_vector);
create index if not exists document_chunks_embedding_hnsw_idx on public.document_chunks using hnsw (embedding vector_cosine_ops);

create table if not exists public.ingestion_jobs (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    meta_message_id text not null unique,
    sender text not null,
    media_id text not null,
    message_type text not null check (message_type in ('document', 'image')),
    original_filename text not null,
    mime_type text,
    status text not null default 'queued' check (status in ('queued', 'processing', 'needs_confirmation', 'completed', 'failed')),
    attempt_count integer not null default 0,
    last_error text,
    drive_file_id text,
    file_id uuid references public.files(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    completed_at timestamptz
);
create index if not exists ingestion_jobs_claim_idx on public.ingestion_jobs (status, created_at) where status in ('queued', 'failed');
create index if not exists ingestion_jobs_user_idx on public.ingestion_jobs (user_id, created_at desc);

create table if not exists public.search_feedback (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    query text not null,
    shown_file_ids uuid[] not null default '{}',
    selected_file_id uuid references public.files(id) on delete set null,
    feedback_type text not null default 'selected' check (feedback_type in ('selected', 'not_found', 'classification_corrected')),
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);
create index if not exists search_feedback_user_idx on public.search_feedback (user_id, created_at desc);

alter table public.document_chunks enable row level security;
alter table public.ingestion_jobs enable row level security;
alter table public.search_feedback enable row level security;

create policy "Users can view own document chunks" on public.document_chunks for select to authenticated using (auth.uid() = user_id);
create policy "Users can insert own document chunks" on public.document_chunks for insert to authenticated with check (auth.uid() = user_id);
create policy "Users can update own document chunks" on public.document_chunks for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own document chunks" on public.document_chunks for delete to authenticated using (auth.uid() = user_id);
create policy "Users can view own ingestion jobs" on public.ingestion_jobs for select to authenticated using (auth.uid() = user_id);
create policy "Users can view own search feedback" on public.search_feedback for select to authenticated using (auth.uid() = user_id);
create policy "Users can insert own search feedback" on public.search_feedback for insert to authenticated with check (auth.uid() = user_id);
