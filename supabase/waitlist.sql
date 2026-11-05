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

-- "Hide me": a hidden profile is not shown in Discover or in crush grids.
alter table public.profiles add column if not exists hidden boolean not null default false;
grant select (hidden) on public.profiles to authenticated;

-- Existing accounts count toward their school's goal.
insert into public.waitlist (email, school_domain, first_name, gender, has_account, launch_emailed_at)
select lower(edu_email),
       (regexp_match(split_part(lower(edu_email), '@', 2), '([^.]+\.[^.]+)$'))[1],
       coalesce(name, ''), coalesce(gender, ''), true, now()
from public.profiles
where edu_email is not null and edu_email like '%@%'
on conflict (email) do nothing;

insert into public.schools (domain)
select distinct school_domain from public.waitlist
on conflict (domain) do nothing;

-- A secret crush stays "waiting" for its target until they have been through the grid.
alter table public.crushes add column if not exists revealed_at timestamptz;

-- Profiles are now only created by the server's finish screen, so nobody can skip the waiting list by writing their own.
revoke insert on public.profiles from anon, authenticated;
