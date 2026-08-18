create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    name text,
    phone text,
    root_folder_id text,
    status text default 'PENDING',
    temp_syllabus_list jsonb,
    folder_map jsonb,
    google_token jsonb,
    avatar_url text
);

create table if not exists public.files (
    id uuid primary key default gen_random_uuid(),
    created_at timestamptz default now(),
    user_id uuid references auth.users(id) on delete cascade,
    file_name text not null,
    drive_file_id text not null,
    folder_id text,
    subject text,
    tags jsonb default '[]'::jsonb
);

alter table public.profiles enable row level security;
drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);

alter table public.profiles replica identity full;
do $$
begin
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profiles'
    ) then
        alter publication supabase_realtime add table public.profiles;
    end if;
end;
$$;
