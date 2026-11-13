-- TopTrack: one pick a day instead of a top three.
--
-- Once you've posted, you pick the one song on your globe that hit hardest
-- today (never your own) with the TopTrack hand on its cover. Each pick is
-- one point for that friend. Picks still live in public.votes (always
-- rank 1 from now on), and you can change yours until your own midnight.
-- Votes already cast as a top three each count as one point.
--
-- Run this once in the Supabase SQL Editor, after 20261113000000_rankings.sql.
-- It's safe to run again.

-- Make a song your TopTrack today, or take your pick back with null.
-- Picking another song moves your pick there.
create or replace function public.pick_song(p_post uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  today date;
  poster uuid;
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

  select p.user_id into poster
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
  insert into public.votes (voter_id, day, rank, post_id, poster_id)
  values (me, today, 1, p_post, poster);
end;
$$;

revoke all on function public.pick_song(uuid) from public, anon;
grant execute on function public.pick_song(uuid) to authenticated;

-- The old top-three picker is gone.
drop function if exists public.rank_song(int, uuid);

-- One point per pick: this month's finished days, and yesterday's.
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
    -- the month of your yesterday, so on the 1st the board still shows how
    -- last month ended until the first new day is in
    select date_trunc('month', public.current_day(auth.uid()) - 1)::date as d
  )
  select v.poster_id,
         count(*)::int,
         (count(*) filter (where p.day = public.current_day(v.poster_id) - 1))::int
  from public.votes v
  join public.posts p on p.id = v.post_id
  where v.poster_id in (select id from shown)
    and p.day >= (select d from since)
    and p.day < public.current_day(v.poster_id)
  group by v.poster_id;
$$;

revoke all on function public.leaderboard() from public, anon;
grant execute on function public.leaderboard() to authenticated;
