-- Song of the Day: hiding someone's songs from your globe.
--
-- A quiet mute, separate from block: you still follow them and they still
-- see your songs, but theirs stay off your globe. Only you can see who you've
-- hidden; they're never told.

create table public.hidden_songs (
  user_id uuid not null default auth.uid()
    references public.profiles (id) on delete cascade,
  hidden_id uuid not null
    references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, hidden_id),
  check (user_id <> hidden_id)
);

alter table public.hidden_songs enable row level security;

create policy "See who you've hidden" on public.hidden_songs
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Hide as yourself" on public.hidden_songs
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Unhide as yourself" on public.hidden_songs
  for delete to authenticated using (user_id = (select auth.uid()));

grant select, insert, delete on public.hidden_songs to authenticated;
