-- Song of the Day: what a public launch needs. Delete your account, block
-- and report people, and file a copyright takedown.

-- ---------------------------------------------------------------------------
-- Delete your account
--
-- Removing the sign-in removes everything else with it: the profile, then
-- (by cascade) posts, follows both ways, redos, blocks, reports you filed and
-- the Spotify link. Photos are removed from storage by the app first.
-- ---------------------------------------------------------------------------

create function public.delete_me() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = 'P0001';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_me() from public, anon;
grant execute on function public.delete_me() to authenticated;

-- ---------------------------------------------------------------------------
-- Blocking
--
-- Blocking someone ends follows both ways, and from then on neither of you
-- sees the other: not on the globe, not in search, not their core.
-- ---------------------------------------------------------------------------

create table public.blocks (
  blocker_id uuid not null default auth.uid()
    references public.profiles (id) on delete cascade,
  blocked_id uuid not null
    references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index blocks_blocked_idx on public.blocks (blocked_id);

alter table public.blocks enable row level security;

create policy "See who you blocked" on public.blocks
  for select to authenticated using (blocker_id = (select auth.uid()));
create policy "Unblock" on public.blocks
  for delete to authenticated using (blocker_id = (select auth.uid()));

grant select, delete on public.blocks to authenticated;

-- Everyone the current person mustn't see: whoever they blocked, and whoever
-- blocked them (without telling them who that is).
create function public.hidden_people() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select b.blocked_id from public.blocks b where b.blocker_id = auth.uid()
  union
  select b.blocker_id from public.blocks b where b.blocked_id = auth.uid();
$$;

grant execute on function public.hidden_people() to anon, authenticated;

create function public.block_user(target uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or target = auth.uid() then
    raise exception 'Can''t block that person' using errcode = 'P0001';
  end if;
  insert into public.blocks (blocker_id, blocked_id)
    values (auth.uid(), target) on conflict do nothing;
  delete from public.follows
    where (follower_id = auth.uid() and following_id = target)
       or (follower_id = target and following_id = auth.uid());
end;
$$;

revoke all on function public.block_user(uuid) from public, anon;
grant execute on function public.block_user(uuid) to authenticated;

-- Who you've blocked, by name, for Settings (their profiles are otherwise
-- hidden from you).
create function public.my_blocks() returns table (id uuid, username text, display_name text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.username, p.display_name
  from public.blocks b join public.profiles p on p.id = b.blocked_id
  where b.blocker_id = auth.uid()
  order by b.created_at desc;
$$;

revoke all on function public.my_blocks() from public, anon;
grant execute on function public.my_blocks() to authenticated;

-- Hide blocked people everywhere content is read, and stop follows across
-- a block.
drop policy "Profiles are public" on public.profiles;
create policy "Profiles are public" on public.profiles
  for select using (
    id = (select auth.uid())
    or (public.can_view() and id not in (select public.hidden_people()))
  );

drop policy "Posts are public" on public.posts;
create policy "Posts are public" on public.posts
  for select using (public.can_view() and user_id not in (select public.hidden_people()));

drop policy "Follows are public" on public.follows;
create policy "Follows are public" on public.follows
  for select using (
    public.can_view()
    and follower_id not in (select public.hidden_people())
    and following_id not in (select public.hidden_people())
  );

drop policy "Follow as yourself" on public.follows;
create policy "Follow as yourself" on public.follows
  for insert to authenticated
  with check (follower_id = (select auth.uid()) and following_id not in (select public.hidden_people()));

-- ---------------------------------------------------------------------------
-- Reports
--
-- Anyone signed in can report a person or one of their songs. Nobody can
-- read reports through the app: they're reviewed in the Supabase Table
-- Editor (reports table).
-- ---------------------------------------------------------------------------

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid()
    references public.profiles (id) on delete cascade,
  reported_id uuid not null
    references public.profiles (id) on delete cascade,
  post_id uuid references public.posts (id) on delete set null,
  reason text not null
    check (reason in ('spam', 'offensive', 'harassment', 'copyright', 'other')),
  note text not null default '' check (char_length(note) <= 500),
  created_at timestamptz not null default now()
);

alter table public.reports enable row level security;

create policy "Report as yourself" on public.reports
  for insert to authenticated
  with check (reporter_id = (select auth.uid()) and reported_id <> (select auth.uid()));

grant insert on public.reports to authenticated;

-- ---------------------------------------------------------------------------
-- Copyright takedowns (DMCA)
--
-- Filed from /copyright by anyone, signed in or not. Reviewed in the Table
-- Editor (takedowns table); remove the post it names and mark it handled.
-- ---------------------------------------------------------------------------

create table public.takedowns (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 200),
  email text not null check (char_length(email) <= 200 and email like '%@%'),
  work text not null check (char_length(btrim(work)) between 1 and 2000),
  song_link text not null check (char_length(btrim(song_link)) between 1 and 2000),
  good_faith boolean not null check (good_faith),
  signature text not null check (char_length(btrim(signature)) between 1 and 200),
  handled boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.takedowns enable row level security;

create policy "Anyone can file a takedown" on public.takedowns
  for insert to anon, authenticated with check (not handled);

grant insert on public.takedowns to anon, authenticated;

-- Removing a post from the Table Editor (say, after a takedown) isn't the
-- poster's redo: only count take-backs made by the poster themselves.
create or replace function public.record_redo() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is distinct from old.user_id
     or not exists (select 1 from public.profiles where id = old.user_id) then
    return old;
  end if;
  insert into public.post_redos (user_id, day) values (old.user_id, old.day);
  return old;
exception when unique_violation then
  raise exception 'You already used today''s redo.' using errcode = 'P0001';
end;
$$;
