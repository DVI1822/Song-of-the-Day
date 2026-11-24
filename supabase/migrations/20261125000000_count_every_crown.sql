-- TopTrack: every crown counts, right away, and stays counted.
--
-- Two fixes to how crowns become points:
--
-- 1. A redo no longer wipes your crowns. Each crown pointed at the song
--    itself, and redoing your song deletes the old one, which took every
--    crown on it along. Now a crown remembers the day it was for
--    (post_day), and when its song is redone it stays as a point for you.
--
-- 2. Crowns count the moment they're given. The board used to take in
--    each day's crowns the next morning; now today's are in the total
--    straight away (and can still move until the crowner's midnight).
--    last_points is now what you've got today.
--
-- Run this once in the Supabase SQL Editor. It's safe to run again.

-- 1. crowns outlive a redo
alter table public.votes add column if not exists post_day date;
update public.votes v set post_day = p.day
  from public.posts p
  where p.id = v.post_id and v.post_day is null;
-- any crown already orphaned is gone; anything left without a day is
-- dated by when it was given, in the crowner's day
update public.votes set post_day = day where post_day is null;
alter table public.votes alter column post_day set not null;

alter table public.votes alter column post_id drop not null;
alter table public.votes drop constraint if exists votes_post_id_fkey;
alter table public.votes add constraint votes_post_id_fkey
  foreign key (post_id) references public.posts (id) on delete set null;

create index if not exists votes_poster_post_day_idx on public.votes (poster_id, post_day);

-- pick_song: the same as before, and it now writes down the song's day
create or replace function public.pick_song(p_post uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  today date;
  poster uuid;
  its_day date;
begin
  if me is null then
    raise exception 'Sign in to pick your TopTrack.' using errcode = 'P0001';
  end if;
  today := public.current_day(me);

  if p_post is null then
    delete from public.votes v where v.voter_id = me and v.day = today;
    return;
  end if;

  if not exists (select 1 from public.posts p where p.user_id = me and p.day = today) then
    raise exception 'Post your song first, then pick your TopTrack.' using errcode = 'P0001';
  end if;

  select p.user_id, p.day into poster, its_day
  from public.posts p
  where p.id = p_post and p.day = public.current_day(p.user_id);
  if poster is null then
    raise exception 'That song isn''t up today.' using errcode = 'P0001';
  end if;
  if poster = me then
    raise exception 'You can''t pick your own song.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.follows f where f.follower_id = me and f.following_id = poster)
     or poster in (select public.hidden_people()) then
    raise exception 'Only songs on your globe can be your TopTrack.' using errcode = 'P0001';
  end if;

  delete from public.votes v where v.voter_id = me and v.day = today;
  insert into public.votes (voter_id, day, rank, post_id, poster_id, post_day)
  values (me, today, 1, p_post, poster, its_day);
end;
$$;

revoke all on function public.pick_song(uuid) from public, anon;
grant execute on function public.pick_song(uuid) to authenticated;

-- One point per crown, this calendar month, today's included.
-- last_points is today's crowns so far.
create or replace function public.leaderboard()
returns table (who uuid, month_points int, last_points int)
language sql stable security definer set search_path = '' as $$
  with people as (
    select auth.uid() as id
    union
    select f.following_id from public.follows f where f.follower_id = auth.uid()
  ), shown as (
    select id from people where id not in (select public.hidden_people())
  ), since as (
    select date_trunc('month', public.current_day(auth.uid()))::date as d
  )
  select v.poster_id,
         count(*)::int,
         (count(*) filter (where v.post_day = public.current_day(v.poster_id)))::int
  from public.votes v
  where v.poster_id in (select id from shown)
    and v.post_day >= (select d from since)
  group by v.poster_id;
$$;

revoke all on function public.leaderboard() from public, anon;
grant execute on function public.leaderboard() to authenticated;
