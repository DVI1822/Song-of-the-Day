-- Song of the Day: the globe chat, and messages to one person.
--
-- One table holds both. A message with no recipient is said to your globe:
-- you see your own, plus those from everyone on your globe (the people
-- you've added). A message with a recipient is a direct message, seen only
-- by the two of you, and only between people where one has added the other.
-- Nothing crosses a block. Messages go with the account, and you can delete
-- your own.

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references public.profiles (id) on delete cascade,
  to_id uuid references public.profiles (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 500),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (to_id is null or to_id <> user_id)
);

create index messages_globe_idx on public.messages (user_id, created_at desc) where to_id is null;
create index messages_to_idx on public.messages (to_id, created_at desc) where to_id is not null;

alter table public.messages enable row level security;

create policy "See your globe's chat and your messages" on public.messages
  for select to authenticated using (
    user_id not in (select public.hidden_people())
    and coalesce(to_id, user_id) not in (select public.hidden_people())
    and (
      user_id = (select auth.uid())
      or to_id = (select auth.uid())
      or (
        to_id is null
        and user_id in (select f.following_id from public.follows f where f.follower_id = (select auth.uid()))
      )
    )
  );

create policy "Talk as yourself, to people you know" on public.messages
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and read_at is null
    and (
      to_id is null
      or (
        to_id not in (select public.hidden_people())
        and exists (
          select 1 from public.follows f
          where (f.follower_id = (select auth.uid()) and f.following_id = to_id)
             or (f.follower_id = to_id and f.following_id = (select auth.uid()))
        )
      )
    )
  );

-- the recipient marks a message read; nothing else about it can change
create policy "Mark your messages read" on public.messages
  for update to authenticated
  using (to_id = (select auth.uid()))
  with check (to_id = (select auth.uid()));

create policy "Delete your own messages" on public.messages
  for delete to authenticated using (user_id = (select auth.uid()));

grant select, insert, delete on public.messages to authenticated;
grant update (read_at) on public.messages to authenticated;

-- live: new messages arrive without a refresh (each person still only gets
-- the ones the rules above let them see)
alter publication supabase_realtime add table public.messages;
