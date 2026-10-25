-- Song of the Day: invite links and finding friends from your contacts.

-- ---------------------------------------------------------------------------
-- Invite links
--
-- Everyone has a link, /join/<username>. Someone who signs up through it
-- lands on the inviter's globe and the inviter on theirs, both ways at once,
-- since sharing your link is saying yes to them. Only a brand new account
-- (made in the last day) gets the inviter's follow back; anyone else who
-- opens a link just adds the inviter, like Find a friend.
-- ---------------------------------------------------------------------------

create function public.accept_invite(inviter text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  them uuid;
  fresh boolean;
begin
  if me is null then
    raise exception 'Not signed in' using errcode = 'P0001';
  end if;
  select p.id into them from public.profiles p
    where p.username = lower(btrim(inviter))
      and p.id not in (select public.hidden_people());
  if them is null or them = me then
    return null;
  end if;
  select p.created_at > now() - interval '1 day' into fresh
    from public.profiles p where p.id = me;
  if fresh is null then
    return null;
  end if;

  insert into public.follows (follower_id, following_id)
    values (me, them) on conflict do nothing;
  if fresh then
    insert into public.follows (follower_id, following_id)
      values (them, me) on conflict do nothing;
  end if;
  return them;
end;
$$;

revoke all on function public.accept_invite(text) from public, anon;
grant execute on function public.accept_invite(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Friends from your contacts
--
-- The phone hands over the emails of the contacts you pick; this says which
-- of them have an account. Emails are only compared, never stored, and at
-- most 100 go in per call.
-- ---------------------------------------------------------------------------

create function public.people_by_email(emails text[])
returns table (id uuid, username text, display_name text, email text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = 'P0001';
  end if;
  if coalesce(array_length(emails, 1), 0) > 100 then
    raise exception 'Too many at once' using errcode = 'P0001';
  end if;
  return query
    select p.id, p.username, p.display_name, lower(u.email)::text
    from auth.users u
    join public.profiles p on p.id = u.id
    where lower(u.email) in (select lower(btrim(e)) from unnest(emails) e)
      and p.id <> auth.uid()
      and p.id not in (select public.hidden_people());
end;
$$;

revoke all on function public.people_by_email(text[]) from public, anon;
grant execute on function public.people_by_email(text[]) to authenticated;
