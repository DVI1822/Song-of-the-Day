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

-- One redo per day: you can take back today's song once and pick another,
-- but not a second time. Taking a song back records the day here, and a
-- second take-back on the same day hits the primary key and is refused.
create table public.post_redos (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);

create function public.record_redo() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- Deleting a whole account removes its posts too; that isn't a redo.
  if not exists (select 1 from public.profiles where id = old.user_id) then
    return old;
  end if;
  insert into public.post_redos (user_id, day) values (old.user_id, old.day);
  return old;
exception when unique_violation then
  raise exception 'You already used today''s redo.' using errcode = 'P0001';
end;
$$;

create trigger posts_record_redo
  before delete on public.posts
  for each row execute function public.record_redo();

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
-- Invite-only mode
--
-- While app_settings.invite_only is true (the default), only emails listed in
-- `invites` can create a profile, and only people with a profile can see
-- anything. To open the site to everyone, set invite_only to false.
-- ---------------------------------------------------------------------------

create table public.app_settings (
  id boolean primary key default true check (id), -- there is only ever one row
  invite_only boolean not null default true
);
insert into public.app_settings default values;

create table public.invites (
  email text primary key check (email = lower(btrim(email)) and email like '%@%'),
  note text,
  created_at timestamptz not null default now()
);

-- Lowercase and trim emails typed into the Table Editor, so "Maya@Gmail.com "
-- still matches.
create function public.normalize_invite() returns trigger
language plpgsql as $$
begin
  new.email := lower(btrim(new.email));
  return new;
end;
$$;

create trigger invites_normalize
  before insert or update on public.invites
  for each row execute function public.normalize_invite();

-- May the signed-in person join?
create function public.is_invited() returns boolean
language sql stable security definer set search_path = '' as $$
  select not (select s.invite_only from public.app_settings s)
    or exists (
      select 1 from public.invites i
      where i.email = lower(coalesce(auth.jwt() ->> 'email', ''))
    );
$$;

-- May the current visitor see the site's content?
create function public.can_view() returns boolean
language sql stable security definer set search_path = '' as $$
  select not (select s.invite_only from public.app_settings s)
    or exists (select 1 from public.profiles p where p.id = auth.uid());
$$;

grant execute on function public.is_invited(), public.can_view() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row level security: content is readable by everyone once the site is
-- public (by members only while it's invite-only), and people can only
-- change their own rows.
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.follows enable row level security;
alter table public.post_redos enable row level security;
-- No policies on these two: they're only changed from the Supabase dashboard.
alter table public.app_settings enable row level security;
alter table public.invites enable row level security;

create policy "Profiles are public" on public.profiles
  for select using (id = (select auth.uid()) or public.can_view());
create policy "Create your own profile" on public.profiles
  for insert to authenticated
  with check (id = (select auth.uid()) and public.is_invited());
create policy "Edit your own profile" on public.profiles
  for update to authenticated using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "Posts are public" on public.posts
  for select using (public.can_view());
create policy "Post as yourself" on public.posts
  for insert to authenticated with check (user_id = (select auth.uid()));
-- You can take back today's song once (see post_redos), but the archive
-- is permanent.
create policy "Delete your post from today" on public.posts
  for delete to authenticated
  using (user_id = (select auth.uid())
         and day = public.current_day((select auth.uid())));

create policy "See your own redos" on public.post_redos
  for select to authenticated using (user_id = (select auth.uid()));

create policy "Follows are public" on public.follows
  for select using (public.can_view());
create policy "Follow as yourself" on public.follows
  for insert to authenticated with check (follower_id = (select auth.uid()));
create policy "Unfollow as yourself" on public.follows
  for delete to authenticated using (follower_id = (select auth.uid()));

grant select on public.profiles, public.posts, public.follows, public.today_posts
  to anon, authenticated;
grant select on public.post_redos to authenticated;
grant insert, update on public.profiles to authenticated;
grant insert, delete on public.posts to authenticated;
grant insert, delete on public.follows to authenticated;
