create table if not exists public.email_codes (
  email text not null,
  purpose text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  created_at timestamptz not null default now(),
  primary key (email, purpose)
);
-- RLS on with no policies: only the server (service role) can touch it.
alter table public.email_codes enable row level security;
