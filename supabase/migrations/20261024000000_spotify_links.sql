-- Spotify accounts linked for full-song playback. Our play button starts the
-- song on the person's own Spotify app through Spotify's Web API, which needs
-- their permission (a refresh token) stored here. Only its owner can see a row.

create table public.spotify_links (
  user_id uuid primary key references auth.users (id) on delete cascade,
  refresh_token text not null,
  access_token text,
  expires_at timestamptz,
  spotify_name text,
  created_at timestamptz not null default now()
);

alter table public.spotify_links enable row level security;

create policy "Your own Spotify link" on public.spotify_links
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
