-- Song of the Day: signing in a home-screen app from an email link.
--
-- On a phone the sign-in link opens in Safari or the mail app's own browser,
-- never in the Song of the Day app on the home screen, which keeps its own
-- separate sign-in. So the screen that asked for the link waits, and the page
-- the link opens hands the sign-in over to it: it leaves the session here
-- under a random id that only that email and that waiting screen know, and
-- the waiting screen picks it up (once) and is signed in. Nothing here can be
-- read or listed directly, and anything left over is gone after 15 minutes.

create table public.sign_in_handoffs (
  id uuid primary key,
  refresh_token text not null,
  created_at timestamptz not null default now()
);
alter table public.sign_in_handoffs enable row level security;
revoke all on public.sign_in_handoffs from anon, authenticated;

-- the link's page, signed in, leaves its session for the waiting screen
create function public.put_handoff(handoff uuid, token text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    return;
  end if;
  delete from public.sign_in_handoffs where created_at < now() - interval '15 minutes';
  insert into public.sign_in_handoffs (id, refresh_token) values (handoff, token) on conflict (id) do nothing;
end;
$$;

-- the waiting screen picks it up, and it's gone
create function public.claim_handoff(handoff uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  token text;
begin
  delete from public.sign_in_handoffs
    where id = handoff and created_at > now() - interval '15 minutes'
    returning refresh_token into token;
  return token;
end;
$$;

revoke all on function public.put_handoff(uuid, text) from public, anon;
revoke all on function public.claim_handoff(uuid) from public;
grant execute on function public.put_handoff(uuid, text) to authenticated;
grant execute on function public.claim_handoff(uuid) to anon, authenticated;
