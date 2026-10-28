-- Song of the Day: the globe chat and messages are for mutual friends only.
--
-- Before, anyone who added you could read what you said to your globe and
-- message you, and adding needs no say from you. Now a globe message reaches
-- only people you've added who have added you back, and a direct message can
-- only be sent between two people who have added each other. Conversations
-- you already had stay readable to the two of you.

create function public.is_mutual(other uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.follows a
    join public.follows b on b.follower_id = a.following_id and b.following_id = a.follower_id
    where a.follower_id = (select auth.uid()) and a.following_id = other
  );
$$;

revoke all on function public.is_mutual(uuid) from public, anon;
grant execute on function public.is_mutual(uuid) to authenticated;

drop policy "See your globe's chat and your messages" on public.messages;
create policy "See your globe's chat and your messages" on public.messages
  for select to authenticated using (
    user_id not in (select public.hidden_people())
    and coalesce(to_id, user_id) not in (select public.hidden_people())
    and (
      user_id = (select auth.uid())
      or to_id = (select auth.uid())
      or (to_id is null and public.is_mutual(user_id))
    )
  );

drop policy "Talk as yourself, to people you know" on public.messages;
create policy "Talk as yourself, to people you know" on public.messages
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and read_at is null
    and (to_id is null or (to_id not in (select public.hidden_people()) and public.is_mutual(to_id)))
  );
