create table if not exists public.crushes (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null,
  target_email text not null,
  emailed boolean not null default false,
  created_at timestamptz not null default now(),
  unique (sender_id, target_email)
);
create table if not exists public.crush_optout (email text primary key);
alter table public.crushes enable row level security;
alter table public.crush_optout enable row level security;
