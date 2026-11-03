-- TopTrack: a few facts about each song, shown under the Globe after you post.
--
-- One row per song (keyed by artist and title, so every version of a song
-- shares it), made once by the server from Wikipedia and music sites and saved here with the
-- Supabase secret key. Anyone signed in can read them; nobody can write them
-- from the browser.

create table if not exists public.song_facts (
  song_key text primary key,
  title text not null,
  artist text not null,
  facts jsonb not null default '[]'::jsonb,   -- [{ "text": ..., "about": "song" | "artist", "source": { "name", "url" } }]
  photo jsonb,                                -- a Wikimedia Commons photo of the artist: { url, page, credit, license, ... }
  made_by text not null,                      -- the Claude model, or "wikipedia"
  created_at timestamptz not null default now()
);

alter table public.song_facts enable row level security;
revoke all on public.song_facts from anon, authenticated;
grant select on public.song_facts to authenticated;

create policy "Anyone signed in can read song facts"
  on public.song_facts for select to authenticated using (true);
