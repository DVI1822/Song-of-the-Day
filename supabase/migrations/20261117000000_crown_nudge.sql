-- TopTrack: a 6 PM reminder to hand out your crown.
--
-- The hourly nudge (20261031000000_push.sql) now has a third stop. At 6 PM
-- in your own time zone, if you've posted today but haven't crowned a song
-- yet, and at least one song on your globe is up for crowning (someone you
-- added posted today, you haven't hidden their songs, and neither of you
-- blocked the other), you get "Who gets your crown today?". People who
-- haven't posted yet can't crown, so they keep getting the noon and 9 PM
-- nudges instead.
--
-- Run this once in the Supabase SQL Editor. It's safe to run again, and
-- the hourly schedule stays as it is.

create or replace function public.push_tick() returns void
language plpgsql security definer set search_path = '' as $$
declare
  cfg public.push_config;
  batch jsonb;
begin
  select * into cfg from public.push_config limit 1;
  if cfg is null then
    return;
  end if;
  with subs as (
    select s.endpoint, s.p256dh, s.auth, s.user_id,
           extract(hour from now() at time zone pr.timezone)::int as hr,
           (now() at time zone pr.timezone)::date as today
    from public.push_subs s
    join public.profiles pr on pr.id = s.user_id
    where extract(hour from now() at time zone pr.timezone) in (12, 18, 21)
  ), due as (
    select u.*,
           exists (
             select 1 from public.posts p
             where p.user_id = u.user_id and p.day = u.today
           ) as posted
    from subs u
  )
  select jsonb_agg(jsonb_build_object(
      'endpoint', d.endpoint, 'p256dh', d.p256dh, 'auth', d.auth,
      'kind', case d.hr when 12 then 'noon' when 18 then 'crown' else 'night' end))
    into batch
    from due d
    where (d.hr in (12, 21) and not d.posted)
       or (d.hr = 18 and d.posted
           and not exists (
             select 1 from public.votes v where v.voter_id = d.user_id and v.day = d.today
           )
           and exists (
             select 1
             from public.follows f
             join public.posts p on p.user_id = f.following_id
             join public.profiles fp on fp.id = f.following_id
             where f.follower_id = d.user_id
               and f.following_id <> d.user_id
               and p.day = (now() at time zone coalesce(fp.timezone, 'UTC'))::date
               and not exists (
                 select 1 from public.hidden_songs h
                 where h.user_id = d.user_id and h.hidden_id = f.following_id
               )
               and not exists (
                 select 1 from public.blocks b
                 where (b.blocker_id = d.user_id and b.blocked_id = f.following_id)
                    or (b.blocker_id = f.following_id and b.blocked_id = d.user_id)
               )
           ));
  if batch is null then
    return;
  end if;
  perform net.http_post(
    url := cfg.url,
    headers := jsonb_build_object('content-type', 'application/json', 'x-push-secret', cfg.secret),
    body := jsonb_build_object('subs', batch)
  );
end;
$$;

revoke all on function public.push_tick() from public, anon, authenticated;
