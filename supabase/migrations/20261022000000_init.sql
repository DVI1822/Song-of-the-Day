-- Song of the Day: initial schema.
--
-- profiles  one row per person (linked to their Supabase login)
-- posts     one song per person per day; past days are their archive
-- follows   who follows whom
--
-- "Day" always means the poster's own calendar day, in their own timezone.
-- When their midnight passes, yesterday's post simply becomes part of their
-- archive, so no nightly job is needed.

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique
    check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null
    check (char_length(btrim(display_name)) between 1 and 40),
  timezone text not null default 'UTC',
  created_at timestamptz not null default now()
);

-- Reject timezone names Postgres doesn't know, so day math never fails later.
create function public.check_timezone() returns trigger
language plpgsql as $$
begin
  perform now() at time zone new.timezone;
  return new;
exception when others then
  raise exception 'Unknown timezone: %', new.timezone;
end;
$$;

create trigger profiles_check_timezone
  before insert or update of timezone on public.profiles
  for each row execute function public.check_timezone();

-- The calendar date it currently is for a given person.
create function public.current_day(uid uuid) returns date
language sql stable security definer set search_path = '' as $$
  select (now() at time zone coalesce(
    (select p.timezone from public.profiles p where p.id = uid), 'UTC'))::date;
$$;

-- ---------------------------------------------------------------------------
-- Posts
-- ---------------------------------------------------------------------------

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references public.profiles (id) on delete cascade,
  day date not null default current_date,
  song_url text not null check (song_url ~ '^https://'),
  page_url text check (page_url ~ '^https://'),
  title text not null check (char_length(title) between 1 and 200),
  artist text not null check (char_length(artist) <= 200),
  artwork_url text check (artwork_url ~ '^https://'),
  platform_links jsonb not null default '{}'::jsonb,
  caption text not null default ''
    check (char_length(caption) <= 100),
  created_at timestamptz not null default now(),
  unique (user_id, day)
);

create index posts_day_idx on public.posts (day);

-- The server decides who posted and which day it counts for, never the client.
create function public.stamp_post() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.user_id := auth.uid();
  new.day := public.current_day(new.user_id);
  new.created_at := now();
  return new;
end;
$$;

create trigger posts_stamp
  before insert on public.posts
  for each row execute function public.stamp_post();

-- Each person's song for their own "today". Anyone without a row hasn't
-- posted yet.
create view public.today_posts with (security_invoker = true) as
  select p.*
  from public.posts p
  join public.profiles pr on pr.id = p.user_id
  where p.day = (now() at time zone pr.timezone)::date;

-- ---------------------------------------------------------------------------
-- Follows
-- ---------------------------------------------------------------------------

create table public.follows (
  follower_id uuid not null default auth.uid()
    references public.profiles (id) on delete cascade,
  following_id uuid not null
    references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create index follows_following_idx on public.follows (following_id);

-- ---------------------------------------------------------------------------
-- Row level security: everything is publicly readable (it's a public site),
-- and people can only change their own rows.
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.follows enable row level security;

create policy "Profiles are public" on public.profiles
  for select using (true);
create policy "Create your own profile" on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));
create policy "Edit your own profile" on public.profiles
  for update to authenticated using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "Posts are public" on public.posts
  for select using (true);
create policy "Post as yourself" on public.posts
  for insert to authenticated with check (user_id = (select auth.uid()));
-- You can take back today's song (and post a different one), but the
-- archive is permanent.
create policy "Delete your post from today" on public.posts
  for delete to authenticated
  using (user_id = (select auth.uid())
         and day = public.current_day((select auth.uid())));

create policy "Follows are public" on public.follows
  for select using (true);
create policy "Follow as yourself" on public.follows
  for insert to authenticated with check (follower_id = (select auth.uid()));
create policy "Unfollow as yourself" on public.follows
  for delete to authenticated using (follower_id = (select auth.uid()));

grant select on public.profiles, public.posts, public.follows, public.today_posts
  to anon, authenticated;
grant insert, update on public.profiles to authenticated;
grant insert, delete on public.posts to authenticated;
grant insert, delete on public.follows to authenticated;
