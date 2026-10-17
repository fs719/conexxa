create table if not exists public.match_rounds (
  match_id uuid not null,
  level int not null,
  user1_answers jsonb,
  user2_answers jsonb,
  primary key (match_id, level)
);
create table if not exists public.contact_exchange (
  match_id uuid primary key,
  user1_kind text, user1_value text,
  user2_kind text, user2_value text
);
-- Server-only: row level security on, no policies, so only the app's server can read or write.
alter table public.match_rounds enable row level security;
alter table public.contact_exchange enable row level security;
