-- Song of the Day: feeling someone's song, and leaving notes on it.
--
-- "Feel it" is the like: one per person per song, never on your own. Notes
-- are short comments (up to 200 characters). Both follow the song's own
-- visibility, vanish across a block, and go with the account or the song
-- when either is deleted. You can take back your feel, delete your own
-- notes, and delete any note on your own song.

create table public.feels (
  post_id uuid not null
    references public.posts (id) on delete cascade,
  user_id uuid not null default auth.uid()
    references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index feels_user_idx on public.feels (user_id);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null
    references public.posts (id) on delete cascade,
  user_id uuid not null default auth.uid()
    references public.profiles (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 200),
  created_at timestamptz not null default now()
);

create index notes_post_idx on public.notes (post_id, created_at);
create index notes_user_idx on public.notes (user_id);

alter table public.feels enable row level security;
alter table public.notes enable row level security;

-- Seen by whoever can see the song (the posts policy applies inside the
-- subquery), minus anyone blocked either way.
create policy "Feels follow their song" on public.feels
  for select using (
    public.can_view()
    and user_id not in (select public.hidden_people())
    and post_id in (select p.id from public.posts p)
  );
create policy "Feel others' songs" on public.feels
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and post_id in (select p.id from public.posts p where p.user_id <> (select auth.uid()))
  );
create policy "Take back your feel" on public.feels
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "Notes follow their song" on public.notes
  for select using (
    public.can_view()
    and user_id not in (select public.hidden_people())
    and post_id in (select p.id from public.posts p)
  );
create policy "Leave notes as yourself" on public.notes
  for insert to authenticated
  with check (user_id = (select auth.uid()) and post_id in (select p.id from public.posts p));
create policy "Delete your notes, or notes on your song" on public.notes
  for delete to authenticated using (
    user_id = (select auth.uid())
    or post_id in (select p.id from public.posts p where p.user_id = (select auth.uid()))
  );

grant select on public.feels, public.notes to anon, authenticated;
grant insert, delete on public.feels, public.notes to authenticated;
