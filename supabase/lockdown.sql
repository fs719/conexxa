-- Conexxa privacy lockdown. Safe to run more than once.

-- 1. A public "school" column (just the domain, e.g. georgetown.edu), so the full college email never has to be shared.
alter table public.profiles add column if not exists school_domain text
  generated always as (split_part(lower(edu_email), '@', 2)) stored;

-- 2. The college email is always the verified login email. Nobody can type a fake one.
create or replace function public.force_verified_edu_email() returns trigger
language plpgsql security definer set search_path = public, auth as $$
declare v text;
begin
  if auth.uid() is null then return new; end if;
  select lower(email) into v from auth.users where id = new.id;
  if v is not null then new.edu_email := v; end if;
  return new;
end $$;
drop trigger if exists profiles_force_edu_email on public.profiles;
create trigger profiles_force_edu_email before insert or update on public.profiles
  for each row execute function public.force_verified_edu_email();

-- 3. Profiles: logged-in users only, and never the email column.
do $$
declare cols text;
begin
  select string_agg(quote_ident(column_name), ',') into cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'profiles' and column_name <> 'edu_email';
  revoke select on public.profiles from anon, authenticated;
  execute format('grant select (%s) on public.profiles to authenticated', cols);
end $$;

-- 4. Matches can only be changed by the app's server.
revoke insert, update, delete on public.matches from anon, authenticated;
