alter table public.profiles
    add column if not exists whatsapp_verified boolean not null default false;
