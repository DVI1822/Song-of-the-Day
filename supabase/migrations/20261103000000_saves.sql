-- Song of the Day: saving someone's song to your core, to find it later.
--
-- Only you can see what you've saved. If the song or its poster goes away,
-- so does the save; a song from someone you've blocked or hidden stays
-- saved but drops out of the list, since you can't see their songs.

create table public.saves (
  user_id uuid not null default auth.uid()
    references public.profiles (id) on delete cascade,
  post_id uuid not null
    references public.posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create index saves_user_idx on public.saves (user_id, created_at desc);
alter table public.saves enable row level security;

create policy "See your saves" on public.saves
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Save as yourself" on public.saves
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Unsave your own" on public.saves
  for delete to authenticated using (user_id = (select auth.uid()));

grant select, insert, delete on public.saves to authenticated;
