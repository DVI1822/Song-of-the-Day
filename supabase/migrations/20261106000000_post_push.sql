-- Song of the Day: a notification when someone on your globe posts their
-- song of the day.
--
-- Uses the same push set-up as the nudges and likes (20261031000000_push.sql,
-- 20261102000000_like_note_push.sql). Everyone who has the poster on their
-- globe hears about it, unless they've hidden the poster's songs or either
-- of them has blocked the other. A redo later the same day doesn't notify
-- again.

create table public.push_posted (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  primary key (user_id, day)
);
alter table public.push_posted enable row level security;
revoke all on public.push_posted from anon, authenticated;

create function public.push_post() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  cfg public.push_config;
  who text;
  batch jsonb;
begin
  select * into cfg from public.push_config limit 1;
  if cfg is null then
    return null;
  end if;
  insert into public.push_posted (user_id, day) values (new.user_id, new.day) on conflict do nothing;
  if not found then
    return null;
  end if;
  select pr.display_name into who from public.profiles pr where pr.id = new.user_id;
  select jsonb_agg(jsonb_build_object(
      'endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth,
      'kind', 'post', 'title', who || ' posted today''s song', 'body', new.title || ' · ' || new.artist,
      'tag', 'posted-' || new.user_id))
    into batch
    from public.follows f
    join public.push_subs s on s.user_id = f.follower_id
    where f.following_id = new.user_id
      and f.follower_id <> new.user_id
      and not exists (select 1 from public.hidden_songs h where h.user_id = f.follower_id and h.hidden_id = new.user_id)
      and not exists (
        select 1 from public.blocks b
        where (b.blocker_id = f.follower_id and b.blocked_id = new.user_id)
           or (b.blocker_id = new.user_id and b.blocked_id = f.follower_id)
      );
  if batch is not null then
    perform net.http_post(
      url := cfg.url,
      headers := jsonb_build_object('content-type', 'application/json', 'x-push-secret', cfg.secret),
      body := jsonb_build_object('subs', batch)
    );
  end if;
  return null;
end;
$$;

revoke all on function public.push_post() from public, anon, authenticated;

create trigger posts_push after insert on public.posts
  for each row execute function public.push_post();
