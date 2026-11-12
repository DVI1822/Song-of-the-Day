-- TopTrack: rank your top three songs each day, and a monthly leaderboard.
--
-- Once you've posted today, you can give three of today's songs on your
-- globe (people you've added, never yourself) your 1st, 2nd and 3rd. They
-- score 3, 2 and 1 points. You can move your picks around until your own
-- midnight; after that the day's picks stay as they are.
--
-- Votes are anonymous: you can read only your own picks. Everyone's totals
-- come from leaderboard(), which adds the points up without saying who gave
-- them. Points count for the calendar month and start again on the 1st.
-- If someone redoes their song, the votes on the old one go with it.
--
-- Run this once in the Supabase SQL Editor. It's safe to run again.

create table if not exists public.votes (
  voter_id uuid not null references public.profiles (id) on delete cascade,
  day date not null, -- the voter's own day
  rank smallint not null check (rank between 1 and 3),
  post_id uuid not null references public.posts (id) on delete cascade,
  poster_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (voter_id, day, rank),
  unique (voter_id, day, post_id)
);

create index if not exists votes_poster_day_idx on public.votes (poster_id, day);

alter table public.votes enable row level security;

drop policy if exists "See your own picks" on public.votes;
create policy "See your own picks" on public.votes
  for select using (voter_id = auth.uid());

-- Picks change only through rank_song() below.
revoke insert, update, delete on public.votes from anon, authenticated;
grant select on public.votes to authenticated;

-- Give a song your 1st, 2nd or 3rd today (p_post null takes that place
-- back). A song you'd already ranked moves to the new place, and whatever
-- held that place before steps off.
create or replace function public.rank_song(p_rank int, p_post uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  today date;
  poster uuid;
begin
  if me is null then
    raise exception 'Sign in to rank songs.' using errcode = 'P0001';
  end if;
  if p_rank not between 1 and 3 then
    raise exception 'Pick 1st, 2nd or 3rd.' using errcode = 'P0001';
  end if;
  today := public.current_day(me);

  if p_post is null then
    delete from public.votes v where v.voter_id = me and v.day = today and v.rank = p_rank;
    return;
  end if;

  if not exists (select 1 from public.posts p where p.user_id = me and p.day = today) then
    raise exception 'Post your song first, then rank.' using errcode = 'P0001';
  end if;

  select p.user_id into poster
  from public.posts p
  where p.id = p_post and p.day = public.current_day(p.user_id);
  if poster is null then
    raise exception 'That song isn''t up today.' using errcode = 'P0001';
  end if;
  if poster = me then
    raise exception 'You can''t rank your own song.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.follows f where f.follower_id = me and f.following_id = poster)
     or poster in (select public.hidden_people()) then
    raise exception 'Only songs on your globe can be ranked.' using errcode = 'P0001';
  end if;

  delete from public.votes v
  where v.voter_id = me and v.day = today and (v.rank = p_rank or v.post_id = p_post);
  insert into public.votes (voter_id, day, rank, post_id, poster_id)
  values (me, today, p_rank, p_post, poster);
end;
$$;

revoke all on function public.rank_song(int, uuid) from public, anon;
grant execute on function public.rank_song(int, uuid) to authenticated;

-- Points this month (from the 1st of your own month) and today, for you
-- and the people on your globe. Only totals; never who gave them.
create or replace function public.leaderboard()
returns table (who uuid, month_points int, today_points int)
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
         sum(4 - v.rank)::int,
         coalesce(sum(4 - v.rank) filter (where p.day = public.current_day(v.poster_id)), 0)::int
  from public.votes v
  join public.posts p on p.id = v.post_id
  where v.poster_id in (select id from shown)
    and v.day >= (select d from since)
  group by v.poster_id;
$$;

revoke all on function public.leaderboard() from public, anon;
grant execute on function public.leaderboard() to authenticated;
