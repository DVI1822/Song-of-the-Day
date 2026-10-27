-- Song of the Day: a notification when someone likes your song or leaves a
-- note on it.
--
-- Uses the same push set-up as the nudges (20261031000000_push.sql): the
-- database hands the site the poster's subscriptions and the words to show,
-- signed with the shared secret, and the site sends them. A like only
-- notifies once per person per song, however many times it's taken back and
-- given again. Nothing is sent for your own song, or from someone you've
-- blocked.

create table public.push_liked (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  primary key (post_id, user_id)
);
alter table public.push_liked enable row level security;
revoke all on public.push_liked from anon, authenticated;

create function public.push_reaction() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  cfg public.push_config;
  post public.posts;
  who text;
  msg_title text;
  msg_body text;
  batch jsonb;
begin
  select * into cfg from public.push_config limit 1;
  select * into post from public.posts p where p.id = new.post_id;
  if cfg is null or post is null or post.user_id = new.user_id
    or exists (select 1 from public.blocks b where b.blocker_id = post.user_id and b.blocked_id = new.user_id) then
    return null;
  end if;
  select pr.display_name into who from public.profiles pr where pr.id = new.user_id;
  if tg_table_name = 'feels' then
    insert into public.push_liked (post_id, user_id) values (new.post_id, new.user_id) on conflict do nothing;
    if not found then
      return null;
    end if;
    msg_title := who || ' liked your song';
    msg_body := post.title || ' · ' || post.artist;
  else
    msg_title := who || ' left a note on ' || post.title;
    msg_body := new.body;
  end if;
  select jsonb_agg(jsonb_build_object(
      'endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth,
      'kind', 'reaction', 'title', msg_title, 'body', msg_body, 'tag', 'song-' || post.id))
    into batch
    from public.push_subs s
    where s.user_id = post.user_id;
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

revoke all on function public.push_reaction() from public, anon, authenticated;

create trigger feels_push after insert on public.feels
  for each row execute function public.push_reaction();
create trigger notes_push after insert on public.notes
  for each row execute function public.push_reaction();
