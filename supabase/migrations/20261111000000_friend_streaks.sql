-- TopTrack: each friend's streak in the My friends list.
--
-- streaks(ids) returns, for each of these people, how many days in a row
-- they've posted, ending today (or yesterday, if today's song isn't in yet,
-- so the streak is still alive) in their own timezone. People with no live
-- streak are left out. Posts you can't see (hidden or blocked people) don't
-- count, because this runs with your own permissions.
--
-- Run this once in the Supabase SQL Editor. It's safe to run again.

create or replace function public.streaks(ids uuid[])
returns table (who uuid, days int)
language sql stable security invoker set search_path = '' as $$
  with posted as (
    select distinct p.user_id, p.day from public.posts p where p.user_id = any(ids)
  ), runs as (
    -- consecutive days, newest first, share the same day + row number
    select d.user_id,
           d.day + (row_number() over (partition by d.user_id order by d.day desc))::int as grp,
           max(d.day) over (partition by d.user_id) as last
    from posted d
  )
  select r.user_id, count(*)::int
  from runs r
  where r.grp = r.last + 1
    and r.last >= public.current_day(r.user_id) - 1
  group by r.user_id;
$$;

grant execute on function public.streaks(uuid[]) to anon, authenticated;
