-- TopTrack: the core as your profile. Your taste, built from your picks, and
-- how many TopTrack picks each of your songs got.
--
-- song_tags: each song's genre and release year (from Apple's iTunes
-- catalog) and, with a Last.fm key, its top tags. One row per song, keyed
-- like song_facts, so a song five friends posted is looked up once.
--
-- taste_profiles: the Taste Overview Claude writes from someone's picks (a
-- name for their sound, a few lines about it, a few words, and how this
-- month compares), kept so it's only written again after new picks.
--
-- Both are written only by the server with the Supabase secret key; anyone
-- signed in can read them, because your taste is part of your profile.
--
-- core_picks(): how many TopTrack picks each of someone's songs got, once
-- the song's day is over. Totals only, never who picked it.
--
-- Run this once in the Supabase SQL Editor. It's safe to run again.

create table if not exists public.song_tags (
  song_key text primary key,
  genre text,                              -- iTunes primary genre, e.g. "Alternative"
  released int,                            -- release year
  tags text[] not null default '{}',       -- Last.fm top tags, best first
  looked_at timestamptz not null default now()
);

alter table public.song_tags enable row level security;
revoke all on public.song_tags from anon, authenticated;
grant select on public.song_tags to authenticated;
drop policy if exists "Anyone signed in can read song tags" on public.song_tags;
create policy "Anyone signed in can read song tags"
  on public.song_tags for select to authenticated using (true);

create table if not exists public.taste_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  picks int not null,                      -- how many songs it was written from
  overview jsonb not null,                 -- { name, blurb, words[], month }
  made_by text not null,
  made_at timestamptz not null default now()
);

alter table public.taste_profiles enable row level security;
revoke all on public.taste_profiles from anon, authenticated;
grant select on public.taste_profiles to authenticated;
drop policy if exists "Anyone signed in can read taste" on public.taste_profiles;
create policy "Anyone signed in can read taste"
  on public.taste_profiles for select to authenticated
  using (user_id not in (select public.hidden_people()));

create or replace function public.core_picks(p_user uuid)
returns table (post_id uuid, picks int)
language sql stable security definer set search_path = '' as $$
  select v.post_id, count(*)::int
  from public.votes v
  join public.posts p on p.id = v.post_id
  where v.poster_id = p_user
    and p.day < public.current_day(p_user)
    and public.can_view()
    and p_user not in (select public.hidden_people())
  group by v.post_id;
$$;

revoke all on function public.core_picks(uuid) from public, anon;
grant execute on function public.core_picks(uuid) to authenticated;
