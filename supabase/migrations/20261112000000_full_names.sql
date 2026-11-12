-- TopTrack: everyone signs up with a first and last name.
--
-- display_name stays the name shown around the app; the app now saves it
-- as "First Last". People who joined before this have no first/last name
-- yet, so the app asks them once (prefilled from their current name) the
-- next time they open it. New profiles can't be created without both.
--
-- Run this once in the Supabase SQL Editor. It's safe to run again.

alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name text;

alter table public.profiles drop constraint if exists profiles_first_name_check;
alter table public.profiles add constraint profiles_first_name_check
  check (first_name is null or char_length(btrim(first_name)) between 1 and 30);

alter table public.profiles drop constraint if exists profiles_last_name_check;
alter table public.profiles add constraint profiles_last_name_check
  check (last_name is null or char_length(btrim(last_name)) between 1 and 30);

-- "First Last" can be up to 61 characters.
alter table public.profiles drop constraint if exists profiles_display_name_check;
alter table public.profiles add constraint profiles_display_name_check
  check (char_length(btrim(display_name)) between 1 and 61);

-- New accounts must have both names.
create or replace function public.require_full_name() returns trigger
language plpgsql as $$
begin
  if new.first_name is null or new.last_name is null then
    raise exception 'First and last name are required';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_require_full_name on public.profiles;
create trigger profiles_require_full_name
  before insert on public.profiles
  for each row execute function public.require_full_name();
