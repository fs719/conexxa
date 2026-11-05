-- Conexxa waitlist, school gate, crush grid. Safe to run more than once. Only adds things; deletes nothing.

-- One row per school. A school is live once live_at is set. goal is the number of sign-ups needed (change it per school any time).
create table if not exists public.schools (
  domain text primary key,
  goal int not null default 70,
  live_at timestamptz,
  created_at timestamptz not null default now()
);

-- People on the list before their school opens (and, for people who already had accounts, a record so they count toward the goal).
create table if not exists public.waitlist (
  email text primary key,
  school_domain text not null,
  first_name text not null default '',
  gender text not null default '',
  has_account boolean not null default false,
  removed boolean not null default false,
  launch_emailed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists waitlist_school_idx on public.waitlist (school_domain);

-- The grid of schoolmates shown to someone who got a secret crush. Stored so the picks can be checked against what was shown.
create table if not exists public.crush_grids (
  user_id uuid primary key,
  ids uuid[] not null,
  sender_ids uuid[] not null,
  created_at timestamptz not null default now(),
  done_at timestamptz
);

-- RLS on with no policies: only the server (service role) can touch these.
alter table public.schools enable row level security;
alter table public.waitlist enable row level security;
alter table public.crush_grids enable row level security;

-- "Hide me": a hidden profile is not shown in Discover or in crush grids. Not readable by other students (no select grant for it).
alter table public.profiles add column if not exists hidden boolean not null default false;

-- Who someone wants to see is private. Other students can no longer read it straight from the database; the server uses it to pick the deck.
-- Rebuilt as a full column list (like lockdown.sql), so it works whether or not lockdown.sql ran before, and running it twice is safe.
do $$
declare cols text;
begin
  select string_agg(quote_ident(column_name), ',') into cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'profiles' and column_name not in ('edu_email', 'interested_in', 'hidden');
  revoke select on public.profiles from anon, authenticated;
  execute format('grant select (%s) on public.profiles to authenticated', cols);
end $$;

-- A match that came from a secret crush is marked when the grid creates it (and only then), so an ordinary match can never be mistaken for one.
alter table public.matches add column if not exists crush_sender uuid;

-- Run order: crush.sql and lockdown.sql first (this file needs the crushes table), then this file. Safe to run again.
-- Existing accounts count toward their school's goal.
insert into public.waitlist (email, school_domain, first_name, gender, has_account, launch_emailed_at)
select lower(edu_email),
       (regexp_match(split_part(lower(edu_email), '@', 2), '([^.]+\.[^.]+)$'))[1],
       coalesce(name, ''), coalesce(gender, ''), true, now()
from public.profiles
where edu_email is not null and edu_email like '%@%'
  and (regexp_match(split_part(lower(edu_email), '@', 2), '([^.]+\.[^.]+)$'))[1] is not null
on conflict (email) do nothing;

insert into public.schools (domain)
select distinct school_domain from public.waitlist
on conflict (domain) do nothing;

-- A secret crush stays "waiting" for its target until they have been through the grid.
alter table public.crushes add column if not exists revealed_at timestamptz;

-- Profiles are now only created by the server's finish screen, so nobody can skip the waiting list by writing their own.
revoke insert on public.profiles from anon, authenticated;

-- A school that already has its goal in existing accounts opens right away (those people already have accounts, so nobody needs an email).
update public.schools s set live_at = now()
where live_at is null
  and (select count(*) from public.waitlist w where w.school_domain = s.domain and not w.removed) >= s.goal;
