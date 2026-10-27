-- Song of the Day: nudges at noon and 9 PM.
--
-- Each browser that allows notifications leaves a push subscription here.
-- Every hour, the database looks for people whose local time is noon or
-- 9 PM and who haven't posted today, and asks the site to send them a nudge
-- (POST to /api/push/send, signed with a shared secret). Nobody can read
-- the subscriptions or the secret through the app.
--
-- Before running: turn on the pg_cron and pg_net extensions (Database →
-- Extensions), and put the same secret here as PUSH_SECRET in Vercel.

create table public.push_subs (
  endpoint text primary key check (endpoint ~ '^https://'),
  user_id uuid not null default auth.uid()
    references public.profiles (id) on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index push_subs_user_idx on public.push_subs (user_id);
alter table public.push_subs enable row level security;

-- Saving a subscription moves it to whoever is signed in on that browser now.
create function public.save_push(sub_endpoint text, sub_p256dh text, sub_auth text) returns void
language sql security definer set search_path = '' as $$
  insert into public.push_subs (endpoint, user_id, p256dh, auth)
  values (sub_endpoint, (select auth.uid()), sub_p256dh, sub_auth)
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth;
$$;

create function public.drop_my_push(sub_endpoint text) returns void
language sql security definer set search_path = '' as $$
  delete from public.push_subs s where s.endpoint = sub_endpoint and s.user_id = (select auth.uid());
$$;

revoke all on function public.save_push(text, text, text), public.drop_my_push(text) from public, anon;
grant execute on function public.save_push(text, text, text), public.drop_my_push(text) to authenticated;

-- Where to send, and the shared secret. One row, readable by no one.
create table public.push_config (
  id boolean primary key default true check (id),
  url text not null,
  secret text not null
);
alter table public.push_config enable row level security;
revoke all on public.push_config from anon, authenticated;

-- The site reports subscriptions that have gone away (uninstalled, revoked).
create function public.push_gone(key text, endpoints text[]) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.push_config c where c.secret = key) then
    raise exception 'Not allowed' using errcode = 'P0001';
  end if;
  delete from public.push_subs s where s.endpoint = any (endpoints);
end;
$$;

revoke all on function public.push_gone(text, text[]) from public;
grant execute on function public.push_gone(text, text[]) to anon, authenticated;

-- Who to nudge this hour.
create function public.push_tick() returns void
language plpgsql security definer set search_path = '' as $$
declare
  cfg public.push_config;
  batch jsonb;
begin
  select * into cfg from public.push_config limit 1;
  if cfg is null then
    return;
  end if;
  select jsonb_agg(jsonb_build_object(
      'endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth,
      'kind', case when extract(hour from now() at time zone pr.timezone) = 12 then 'noon' else 'night' end))
    into batch
    from public.push_subs s
    join public.profiles pr on pr.id = s.user_id
    where extract(hour from now() at time zone pr.timezone) in (12, 21)
      and not exists (
        select 1 from public.posts p
        where p.user_id = s.user_id and p.day = (now() at time zone pr.timezone)::date
      );
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

select cron.schedule('song-nudges', '0 * * * *', 'select public.push_tick()');
